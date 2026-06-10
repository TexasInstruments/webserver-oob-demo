/*
 * Copyright (C) 2024 Texas Instruments Incorporated - http://www.ti.com/
 *
 * Redistribution and use in source and binary forms, with or without
 * modification, are permitted provided that the following conditions
 * are met:
 *
 * Redistributions of source code must retain the above copyright
 * notice, this list of conditions and the following disclaimer.
 *
 * Redistributions in binary form must reproduce the above copyright
 * notice, this list of conditions and the following disclaimer in the
 * documentation and/or other materials provided with the distribution.
 *
 * Neither the name of Texas Instruments Incorporated nor the names of
 * its contributors may be used to endorse or promote products derived
 * from this software without specific prior written permission.
 *
 * THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS
 * "AS IS" AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT
 * LIMITED TO, THE IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR
 * A PARTICULAR PURPOSE ARE DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT
 * OWNER OR CONTRIBUTORS BE LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL,
 * SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT
 * LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES; LOSS OF USE,
 * DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND ON ANY
 * THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT
 * (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE
 * OF THIS SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
 */

/*
 * speech_utils.c
 *
 * Speech-to-text using Silero en_v5.onnx via NNStreamer + ONNX Runtime.
 *
 * Pipeline:
 *   alsasrc → audioconvert → tensor_converter → tensor_aggregator
 *   → tensor_transform (S16LE→F32, normalise) → tensor_filter (onnxruntime)
 *   → tensor_sink (greedy CTC decode → FIFO)
 *
 * Output FIFO: /tmp/speech_classification_fifo   (one transcript line per flush)
 * PID file:    /tmp/speech_classification.pid
 *
 * Usage:
 *   speech_utils devices
 *   speech_utils start_gst [device]   e.g. plughw:1,0
 *   speech_utils stop_gst
 *   speech_utils status
 */

#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <unistd.h>
#include <signal.h>
#include <fcntl.h>
#include <sys/stat.h>
#include <sys/types.h>
#include <gst/gst.h>

/* ------------------------------------------------------------------ */
/*  Model / pipeline constants                                          */
/* ------------------------------------------------------------------ */
#define VOCAB_SIZE   999
#define BLANK_IDX    0      /* '_' at index 0  */

#define MODEL_PATH   "/usr/share/oob-demo-assets/models/en_v5_static.onnx"
#define FIFO_PATH    "/tmp/speech_classification_fifo"
#define PID_FILE     "/tmp/speech_classification.pid"

/* 3-second window, 1-second stride at 16 kHz mono S16LE */
#define WINDOW_SAMPLES  48000
#define STRIDE_SAMPLES  16000

/* Model I/O: input [1,48000] float32 → output [1,38,999] float32 (static ONNX). */

/* ------------------------------------------------------------------ */
/*  Vocabulary — 999 BPE-style tokens from Silero en_v1_labels.json   */
/*  Index 0 = CTC blank ('_'), index 998 = space (' ')                */
/* ------------------------------------------------------------------ */
static const char *LABELS[VOCAB_SIZE] = {
    "_", "th", "the", "in", "an", "re", "er", "on", "at", "ou",
    "is", "en", "to", "and", "ed", "al", "as", "it", "ing", "or",
    "of", "es", "ar", "he", "le", "st", "se", "om", "ic", "be",
    "we", "ly", "that", "no", "wh", "ve", "ha", "you", "ch", "ion",
    "il", "ent", "ro", "me", "id", "ac", "gh", "for", "was", "lo",
    "ver", "ut", "li", "ld", "ay", "ad", "so", "ir", "im", "un",
    "wi", "ter", "are", "with", "ke", "ge", "do", "ur", "all", "ce",
    "ab", "mo", "go", "pe", "ne", "this", "ri", "ght", "de", "one",
    "us", "am", "out", "fe", "but", "po", "his", "te", "ho", "ther",
    "not", "con", "com", "ll", "they", "if", "ould", "su", "have", "ct",
    "ain", "our", "ation", "fr", "ill", "now", "sa", "had", "tr", "her",
    "per", "ant", "oun", "my", "ul", "ca", "by", "what", "red", "res",
    "od", "ome", "ess", "man", "ex", "she", "pl", "co", "wor", "pro",
    "up", "thing", "there", "ple", "ag", "can", "qu", "art", "ally", "ok",
    "from", "ust", "very", "sh", "ind", "est", "some", "ate", "wn", "ti",
    "fo", "ard", "ap", "him", "were", "ich", "here", "bo", "ity", "um",
    "ive", "ous", "way", "end", "ig", "pr", "which", "ma", "ist", "them",
    "like", "who", "ers", "when", "act", "use", "about", "ound", "gr", "et",
    "ide", "ight", "ast", "king", "would", "ci", "their", "other", "see", "ment",
    "ong", "wo", "ven", "know", "how", "said", "ine", "ure", "more", "der",
    "sel", "br", "ren", "ack", "ol", "ta", "low", "ough", "then", "peo",
    "ye", "ace", "people", "ink", "ort", "your", "will", "than", "pp", "any",
    "ish", "look", "la", "just", "tor", "ice", "itt", "af", "these", "sp",
    "has", "gre", "been", "ty", "ies", "ie", "get", "able", "day", "could",
    "bl", "two", "time", "beca", "into", "age", "ans", "mis", "new", "ree",
    "ble", "ite", "si", "urn", "ass", "cl", "ber", "str", "think", "dis",
    "mar", "ence", "pt", "self", "ated", "did", "el", "don", "ck", "ph",
    "ars", "ach", "fore", "its", "part", "ang", "cre", "well", "ions", "where",
    "ves", "ved", "em", "good", "because", "over", "ud", "ts", "off", "turn",
    "cr", "right", "ress", "most", "every", "pre", "fa", "fir", "ild", "pos",
    "down", "work", "ade", "say", "med", "also", "litt", "little", "ance", "come",
    "ving", "only", "ful", "ought", "want", "going", "spe", "ps", "ater", "first",
    "after", "ue", "ose", "mu", "iz", "ire", "int", "rest", "ser", "coun",
    "des", "light", "son", "let", "ical", "ick", "ra", "back", "mon", "ase",
    "ign", "ep", "world", "may", "read", "form", "much", "even", "should", "again",
    "make", "long", "sto", "cont", "put", "thr", "under", "cor", "bet", "jo",
    "car", "ile", "went", "yes", "ually", "row", "hand", "ak", "call", "ary",
    "ia", "many", "cho", "things", "try", "gl", "ens", "really", "happ", "great",
    "dif", "bu", "hi", "made", "room", "ange", "cent", "ious", "je", "three",
    "ward", "op", "gen", "those", "life", "tal", "pa", "through", "und", "cess",
    "before", "du", "side", "need", "less", "inter", "ting", "ry", "ise", "na",
    "men", "ave", "fl", "ction", "pres", "old", "something", "miss", "never", "got",
    "feren", "imp", "sy", "ations", "tain", "ning", "ked", "sm", "take", "ten",
    "ted", "ip", "col", "own", "stand", "add", "min", "wer", "ms", "ces",
    "gu", "land", "bod", "log", "cour", "ob", "vo", "ition", "hu", "came",
    "comp", "cur", "being", "comm", "years", "ily", "wom", "cer", "kind", "thought",
    "such", "tell", "child", "nor", "bro", "ial", "pu", "does", "head", "clo",
    "ear", "led", "llow", "ste", "ness", "too", "start", "mor", "used", "par",
    "play", "ents", "tri", "upon", "tim", "num", "ds", "ever", "cle", "ef",
    "wr", "vis", "ian", "sur", "same", "might", "fin", "differen", "sho", "why",
    "body", "mat", "beg", "vers", "ouse", "actually", "ft", "ath", "hel", "sha",
    "ating", "ual", "found", "ways", "must", "four", "gi", "val", "di", "tre",
    "still", "tory", "ates", "high", "set", "care", "ced", "last", "find", "au",
    "inte", "ev", "ger", "thank", "ss", "ict", "ton", "cal", "nat", "les",
    "bed", "away", "place", "house", "che", "ject", "sol", "another", "ited", "att",
    "face", "show", "ner", "ken", "far", "ys", "lect", "lie", "tem", "ened",
    "night", "while", "looking", "ah", "wal", "dr", "real", "cha", "exp", "war",
    "five", "pol", "fri", "wa", "cy", "fect", "xt", "left", "give", "soci",
    "cond", "char", "bor", "point", "number", "mister", "called", "six", "bre", "vi",
    "without", "person", "air", "different", "lot", "bit", "pass", "ular", "youn", "won",
    "main", "cri", "ings", "den", "water", "human", "around", "quest", "ters", "ities",
    "feel", "each", "friend", "sub", "though", "saw", "ks", "hund", "hundred", "times",
    "lar", "ff", "amer", "scho", "sci", "ors", "lt", "arch", "fact", "hal",
    "himself", "gener", "mean", "vol", "school", "ason", "fam", "ult", "mind", "itch",
    "ped", "home", "young", "took", "big", "love", "reg", "eng", "sure", "vent",
    "ls", "ot", "ince", "thous", "eight", "thousand", "better", "mom", "appe", "once",
    "ied", "mus", "stem", "sing", "ident", "als", "uh", "mem", "produ", "stud",
    "power", "atch", "bas", "father", "av", "nothing", "gir", "pect", "unt", "few",
    "kes", "eyes", "sk", "always", "ared", "toge", "stru", "together", "ics", "bus",
    "fort", "ween", "rep", "ically", "small", "ga", "mer", "ned", "ins", "between",
    "yet", "stre", "hard", "system", "course", "year", "cept", "publ", "sim", "sou",
    "ready", "follow", "present", "rel", "turned", "sw", "possi", "mother", "io", "bar",
    "ished", "dec", "ments", "pri", "next", "ross", "both", "ship", "ures", "americ",
    "eas", "asked", "iness", "serv", "ists", "ash", "uni", "build", "phone", "lau",
    "ctor", "belie", "change", "interest", "peri", "children", "thir", "lear", "plan", "import",
    "ational", "har", "ines", "dist", "selves", "city", "sen", "run", "law", "ghter",
    "proble", "woman", "done", "heart", "book", "aut", "ris", "lim", "looked", "vid",
    "fu", "bab", "ately", "ord", "ket", "oc", "doing", "area", "tech", "win",
    "name", "second", "certain", "pat", "lad", "quite", "told", "ific", "ative", "uring",
    "gg", "half", "reason", "moment", "ility", "ution", "shall", "aur", "enough", "idea",
    "open", "understand", "vie", "contin", "mal", "hor", "qui", "address", "heard", "help",
    "inst", "oney", "whole", "gover", "commun", "exam", "near", "didn", "logy", "oh",
    "tru", "lang", "restaur", "restaurant", "design", "ze", "talk", "leg", "line", "ank",
    "ond", "country", "ute", "howe", "hold", "live", "comple", "however", "ized", "ush",
    "seen", "bye", "fer", "ital", "women", "net", "state", "bur", "fac", "whe",
    "important", "dar", "nine", "sat", "fic", "known", "having", "against", "soon", "ety",
    "langu", "public", "sil", "best", "az", "knew", "black", "velo", "sort", "seven",
    "imag", "lead", "cap", "ask", "alth", "ature", "nam", "began", "white", "sent",
    "sound", "vir", "days", "anything", "yeah", "ub", "blo", "sun", "story", "dire",
    "money", "trans", "mil", "org", "grow", "cord", "pped", "cus", "spo", "sign",
    "beaut", "goodbye", "inde", "large", "question", "often", "hour", "que", "pur", "town",
    "ield", "coming", "door", "lig", "ling", "incl", "partic", "keep", "engl", "move",
    "later", "ants", "food", "lights", "bal", "words", "list", "aw", "allow", "aren",
    "pret", "tern", "today", "believe", "almost", "bir", "word", "possible", "ither", "case",
    "ried", "ural", "round", "twent", "develo", "plain", "ended", "iting", "chang", "sc",
    "boy", "gy", "since", "ones", "suc", "cas", "national", "plac", "teen", "pose",
    "started", "mas", "fi", "fif", "afr", "fully", "grou", "wards", "girl",
    "e", "t", "a", "o", "i", "n", "s", "h", "r", "l",
    "d", "u", "c", "m", "w", "f", "g", "y", "p", "b",
    "v", "k", "'", "x", "j", "q", "z", "-", "2", " "
};

/* ------------------------------------------------------------------ */
/*  Audio device helpers                                               */
/* ------------------------------------------------------------------ */
#define MAX_DEVICES 10

typedef struct {
    char display_name[128];
    char alsa_device[128];
} audio_device_info;

static audio_device_info audio_devices[MAX_DEVICES];
static int device_count = 0;

static void get_arecord_devices(void)
{
    FILE *fp;
    char line[512];

    device_count = 0;
    memset(audio_devices, 0, sizeof(audio_devices));

    fp = popen("arecord -l 2>/dev/null", "r");
    if (!fp) {
        printf("Error running arecord command\n");
        return;
    }

    char name[256];
    int card_num = -1;

    while (fgets(line, sizeof(line), fp)) {
        if (strncmp(line, "card", 4) != 0) continue;

        sscanf(line, "card %d:", &card_num);

        char *ns = strchr(line, '[');
        char *ne = strchr(line, ']');
        if (!ns || !ne || ne <= ns || device_count >= MAX_DEVICES) continue;

        int nl = ne - ns - 1;
        if (nl <= 0 || nl >= (int)sizeof(name)) continue;

        strncpy(name, ns + 1, nl);
        name[nl] = '\0';

        if (strstr(name, "HDMI")   || strstr(name, "hdmi")   ||
            strstr(name, "Webcam") || strstr(name, "webcam") ||
            strstr(name, "Camera") || strstr(name, "camera") ||
            strstr(name, "cape")) {
            fprintf(stderr, "Skipping non-audio device: %s\n", name);
            continue;
        }

        strncpy(audio_devices[device_count].display_name, name,
                sizeof(audio_devices[device_count].display_name) - 1);
        snprintf(audio_devices[device_count].alsa_device,
                 sizeof(audio_devices[device_count].alsa_device),
                 "plughw:%d,0", card_num);

        fprintf(stderr, "Found capture device: %s -> %s\n",
                name, audio_devices[device_count].alsa_device);
        device_count++;
    }
    pclose(fp);

    if (device_count == 0)
        printf("No audio input devices found\n");
}

/* ------------------------------------------------------------------ */
/*  Greedy CTC decode                                                   */
/*  logits: float[frames][VOCAB_SIZE] (row-major)                      */
/* ------------------------------------------------------------------ */
static void ctc_decode(const float *logits, int frames,
                       char *out, int out_size)
{
    int prev = -1;
    int pos  = 0;
    out[0] = '\0';

    for (int t = 0; t < frames; t++) {
        const float *row = logits + t * VOCAB_SIZE;

        int best = 0;
        for (int v = 1; v < VOCAB_SIZE; v++) {
            if (row[v] > row[best]) best = v;
        }

        /* CTC collapse: skip blank and consecutive repeats */
        if (best != BLANK_IDX && best != prev) {
            const char *tok = LABELS[best];
            int toklen = (int)strlen(tok);
            if (pos + toklen < out_size - 1) {
                memcpy(out + pos, tok, toklen);
                pos += toklen;
            }
        }
        prev = best;
    }
    out[pos] = '\0';
}

/* ------------------------------------------------------------------ */
/*  GStreamer application state                                         */
/* ------------------------------------------------------------------ */
typedef struct {
    GMainLoop  *loop;
    GstElement *pipeline;
    GstBus     *bus;
    int         fifo_fd;
} AppData;

static AppData g_app;

/* tensor_sink "new-data" callback — runs for every 3-second chunk */
static void new_data_cb(GstElement *sink, GstBuffer *buf, gpointer user_data)
{
    AppData *app = (AppData *)user_data;
    GstMapInfo info;

    if (!gst_buffer_map(buf, &info, GST_MAP_READ))
        return;

    int frames = (int)(info.size / (VOCAB_SIZE * sizeof(float)));
    if (frames <= 0) {
        gst_buffer_unmap(buf, &info);
        return;
    }

    char result[2048];
    ctc_decode((const float *)info.data, frames, result, sizeof(result));
    gst_buffer_unmap(buf, &info);

    /* Trim leading/trailing whitespace */
    char *s = result;
    while (*s == ' ') s++;
    int len = (int)strlen(s);
    while (len > 0 && s[len - 1] == ' ') len--;
    s[len] = '\0';

    if (len > 0) {
        fprintf(stderr, "STT: %s\n", s);
        /* Try to open FIFO if reader connected since startup */
        if (app->fifo_fd < 0)
            app->fifo_fd = open(FIFO_PATH, O_WRONLY | O_NONBLOCK);
        if (app->fifo_fd >= 0) {
            char line[2100];
            snprintf(line, sizeof(line), "%s\n", s);
            if (write(app->fifo_fd, line, strlen(line)) < 0) {
                close(app->fifo_fd);
                app->fifo_fd = -1; /* reader gone, reopen next time */
            }
        }
    }
}

/* GstBus message callback */
static void bus_cb(GstBus *bus, GstMessage *msg, gpointer user_data)
{
    AppData *app = (AppData *)user_data;
    (void)bus;

    switch (GST_MESSAGE_TYPE(msg)) {
    case GST_MESSAGE_ERROR: {
        GError *err = NULL;
        gchar  *dbg = NULL;
        gst_message_parse_error(msg, &err, &dbg);
        fprintf(stderr, "GStreamer error: %s\n", err ? err->message : "unknown");
        if (err) g_error_free(err);
        g_free(dbg);
        g_main_loop_quit(app->loop);
        break;
    }
    case GST_MESSAGE_EOS:
        fprintf(stderr, "GStreamer EOS\n");
        g_main_loop_quit(app->loop);
        break;
    default:
        break;
    }
}

/* Signal handler */
static void signal_handler(int signum)
{
    (void)signum;
    if (g_app.loop && g_main_loop_is_running(g_app.loop))
        g_main_loop_quit(g_app.loop);
}

/* ------------------------------------------------------------------ */
/*  start_gst                                                           */
/* ------------------------------------------------------------------ */
static int start_gst(const char *device)
{
    GError     *err = NULL;
    GstElement *sink;
    gchar      *pipeline_str;

    /* Create FIFO */
    unlink(FIFO_PATH);
    if (mkfifo(FIFO_PATH, 0666) != 0) {
        perror("mkfifo");
        return 1;
    }

    /* Open FIFO non-blocking. If no reader yet, fd stays -1 and
     * results are logged to stderr only until a reader connects. */
    g_app.fifo_fd = open(FIFO_PATH, O_WRONLY | O_NONBLOCK);

    /* File path (starts with '/') uses filesrc+wavparse; otherwise alsasrc. */
    if (device[0] == '/') {
        pipeline_str = g_strdup_printf(
            "filesrc location=%s ! wavparse ! "
            "audioconvert ! audioresample ! "
            "audio/x-raw,format=S16LE,channels=1,rate=16000 ! "
            "tensor_converter frames-per-tensor=%d ! "
            "tensor_aggregator frames-in=%d frames-out=%d "
                "frames-flush=%d frames-dim=1 ! "
            "tensor_transform mode=arithmetic "
                "option=typecast:float32,div:32767.5 ! "
            "tensor_filter framework=onnxruntime model=%s ! "
            "tensor_sink name=stt_sink emit-signal=true sync=false",
            device,
            STRIDE_SAMPLES,
            STRIDE_SAMPLES, WINDOW_SAMPLES, STRIDE_SAMPLES,
            MODEL_PATH);
    } else {
        pipeline_str = g_strdup_printf(
            "alsasrc device=%s ! "
            "audioconvert ! "
            "audio/x-raw,format=S16LE,channels=1,rate=16000 ! "
            "tensor_converter frames-per-tensor=%d ! "
            "tensor_aggregator frames-in=%d frames-out=%d "
                "frames-flush=%d frames-dim=1 ! "
            "tensor_transform mode=arithmetic "
                "option=typecast:float32,div:32767.5 ! "
            "tensor_filter framework=onnxruntime model=%s ! "
            "tensor_sink name=stt_sink emit-signal=true sync=false",
            device,
            STRIDE_SAMPLES,
            STRIDE_SAMPLES, WINDOW_SAMPLES, STRIDE_SAMPLES,
            MODEL_PATH);
    }

    fprintf(stderr, "Pipeline: %s\n", pipeline_str);

    g_app.pipeline = gst_parse_launch(pipeline_str, &err);
    g_free(pipeline_str);

    if (!g_app.pipeline || err) {
        fprintf(stderr, "Pipeline parse error: %s\n",
                err ? err->message : "unknown");
        if (err) g_error_free(err);
        return 1;
    }

    /* Connect tensor_sink signal */
    sink = gst_bin_get_by_name(GST_BIN(g_app.pipeline), "stt_sink");
    if (!sink) {
        fprintf(stderr, "Cannot find stt_sink element\n");
        gst_object_unref(g_app.pipeline);
        return 1;
    }
    g_signal_connect(sink, "new-data", G_CALLBACK(new_data_cb), &g_app);
    gst_object_unref(sink);

    /* Bus watch */
    g_app.bus = gst_element_get_bus(g_app.pipeline);
    gst_bus_add_signal_watch(g_app.bus);
    g_signal_connect(g_app.bus, "message", G_CALLBACK(bus_cb), &g_app);

    /* Start */
    if (gst_element_set_state(g_app.pipeline, GST_STATE_PLAYING)
            == GST_STATE_CHANGE_FAILURE) {
        fprintf(stderr, "Failed to set pipeline to PLAYING\n");
        gst_object_unref(g_app.pipeline);
        return 1;
    }

    fprintf(stderr, "Speech-to-text started (device=%s, model=%s)\n",
            device, MODEL_PATH);
    printf("SUCCESS: Speech-to-text started\n");
    fflush(stdout);

    g_main_loop_run(g_app.loop);

    /* Cleanup */
    gst_element_set_state(g_app.pipeline, GST_STATE_NULL);
    gst_bus_remove_signal_watch(g_app.bus);
    gst_object_unref(g_app.bus);
    gst_object_unref(g_app.pipeline);
    if (g_app.fifo_fd >= 0) close(g_app.fifo_fd);
    unlink(FIFO_PATH);
    unlink(PID_FILE);

    return 0;
}

/* ------------------------------------------------------------------ */
/*  main                                                                */
/* ------------------------------------------------------------------ */
int main(int argc, char *argv[])
{
    if (argc > 1 && strcmp(argv[1], "devices") == 0) {
        get_arecord_devices();
        for (int i = 0; i < device_count; i++)
            printf("%s|%s\n",
                   audio_devices[i].alsa_device,
                   audio_devices[i].display_name);
        return 0;
    }

    if (argc > 1 && strcmp(argv[1], "start_gst") == 0) {
        get_arecord_devices();

        /* Resolve requested device → ALSA id or file path */
        char *alsa_dev = NULL;
        int is_file_input = (argc > 2 && argv[2][0] == '/');

        if (!is_file_input && device_count == 0) {
            fprintf(stderr, "No audio input devices found\n");
            printf("ERROR: No audio input devices found\n");
            return 1;
        }

        if (argc > 2) {
            const char *req = argv[2];
            if (req[0] == '/') {
                /* Absolute path — pass directly to start_gst as file input */
                alsa_dev = strdup(req);
            } else if (strncmp(req, "plughw:", 7) == 0) {
                alsa_dev = strdup(req);
            } else {
                for (int i = 0; i < device_count; i++) {
                    if (strcmp(audio_devices[i].display_name, req) == 0) {
                        alsa_dev = strdup(audio_devices[i].alsa_device);
                        break;
                    }
                }
                if (!alsa_dev && device_count > 0)
                    alsa_dev = strdup(audio_devices[0].alsa_device);
            }
        } else {
            alsa_dev = strdup(audio_devices[0].alsa_device);
        }

        if (!alsa_dev) alsa_dev = strdup("plughw:0,0");

        /* Write PID file */
        FILE *pf = fopen(PID_FILE, "w");
        if (pf) { fprintf(pf, "%d\n", getpid()); fclose(pf); }

        /* Signal handlers */
        signal(SIGTERM, signal_handler);
        signal(SIGINT,  signal_handler);

        /* Init GStreamer */
        gst_init(&argc, &argv);
        g_app.loop = g_main_loop_new(NULL, FALSE);

        int ret = start_gst(alsa_dev);
        free(alsa_dev);
        g_main_loop_unref(g_app.loop);
        return ret;
    }

    if (argc > 1 && strcmp(argv[1], "stop_gst") == 0) {
        FILE *pf = fopen(PID_FILE, "r");
        if (pf) {
            pid_t pid;
            if (fscanf(pf, "%d", &pid) == 1) {
                fclose(pf);
                if (kill(pid, SIGTERM) == 0) {
                    printf("SUCCESS: Speech-to-text stopped\n");
                    sleep(1);
                    unlink(PID_FILE);
                } else {
                    perror("kill");
                    printf("ERROR: Failed to stop speech-to-text\n");
                    unlink(PID_FILE);
                }
            } else {
                fclose(pf);
                printf("ERROR: Invalid PID file\n");
                unlink(PID_FILE);
            }
        } else {
            printf("INFO: Speech-to-text not running (no PID file)\n");
        }
        return 0;
    }

    if (argc > 1 && strcmp(argv[1], "status") == 0) {
        FILE *pf = fopen(PID_FILE, "r");
        if (!pf) { printf("STOPPED\n"); return 0; }
        pid_t pid = 0;
        int ok = (fscanf(pf, "%d", &pid) == 1);
        fclose(pf);
        if (ok && kill(pid, 0) == 0) {
            printf("RUNNING\n");
        } else {
            unlink(PID_FILE);
            printf("STOPPED\n");
        }
        return 0;
    }

    printf("Usage:\n");
    printf("  %s devices              - List audio recording devices\n", argv[0]);
    printf("  %s start_gst [device]   - Start speech-to-text pipeline\n", argv[0]);
    printf("  %s stop_gst             - Stop speech-to-text pipeline\n", argv[0]);
    printf("  %s status               - Check if running\n", argv[0]);
    return 1;
}
