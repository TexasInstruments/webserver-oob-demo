/*
 * rpmsg_json.c
 *
 *  Created on: Oct 4, 2014
 *      Author: etsam
 *
 * Software License Agreement (BSD License)
 *
 * ========================================
 * Copyright (c) 2014, Mentor Graphics Corporation. All rights reserved.
 * Copyright (c) 2015 - 2016 Xilinx, Inc. All rights reserved.
 * Copyright (c) 2016 Freescale Semiconductor, Inc. All rights reserved
 * Copyright (c) 2020 Texas Instruments, Inc. All rights reserved
 *
 * Redistribution and use in source and binary forms, with or without
 * modification, are permitted provided that the following conditions are met:
 *
 * 1. Redistributions of source code must retain the above copyright notice,
 *    this list of conditions and the following disclaimer.
 * 2. Redistributions in binary form must reproduce the above copyright notice,
 *    this list of conditions and the following disclaimer in the documentation
 *    and/or other materials provided with the distribution.
 * 3. The names of its contributors may not be used to endorse or promote
 *    products derived from this software without specific prior written
 *    permission.
 *
 * THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS"
 * AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE
 * IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE
 * ARE DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT HOLDER OR CONTRIBUTORS BE
 * LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR
 * CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF
 * SUBSTITUTE GOODS OR SERVICES; LOSS OF USE, DATA, OR PROFITS; OR BUSINESS
 * INTERRUPTION) HOWEVER CAUSED AND ON ANY THEORY OF LIABILITY, WHETHER IN
 * CONTRACT, STRICT LIABILITY, OR TORT (INCLUDING NEGLIGENCE OR OTHERWISE)
 * ARISING IN ANY WAY OUT OF THE USE OF THIS SOFTWARE, EVEN IF ADVISED OF THE
 * POSSIBILITY OF SUCH DAMAGE.
 *
 * This linux userspace application is to get the benchmark
 * data from remote processors via IPC RPMsg_char channels
 * The application sends chunks of data to the
 * remote processor. The remote side replies the data back
 * with the benchmark data. The application will use the
 * obtained benchmark data to update the JSON file.
 */

#include <dirent.h>
#include <errno.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <unistd.h>
#include <sys/ioctl.h>
#include <time.h>
#include <fcntl.h>
#include <string.h>
#include <linux/rpmsg.h>
#include <ti_rpmsg_char.h>
#include "jsmn.h"
#include "benchmark_stat.h"

#ifndef AM65X
#define NUM_R5_CORES 4
#else
#define NUM_R5_CORES 2
#endif
#define NUM_R5_APPS 5
core_stat R5CoreStat[NUM_R5_CORES];
core_output A53CoreStat;
core_input curR5CoreInput[NUM_R5_CORES] = {
  {0, 0, 0},
  {0, 0, 0},
#ifndef AM65X
  {0, 0, 0},
  {0, 0, 0},
#endif
};

/* Change BENCHMARK_DEMO_FW_ROOT is required for this program to run */
/* either provide it via build system or it will be default to the following location */
#ifndef BENCHMARK_DEMO_FW_ROOT
#ifndef AM65X
#define BENCHMARK_DEMO_FW_ROOT "/lib/firmware/sitara-apps/benchmark_demo/out/AM64X/R5F/NO_OS/release"
#else
#define BENCHMARK_DEMO_FW_ROOT "/lib/firmware/sitara-apps/benchmark_demo/out/AM65X/R5F/NO_OS/release"
#endif
#endif

/* Change RPMSG_FW_PATHNAME is required for this program to run */
/* either provide it via build system or it will be default to the following location */
#ifndef RPMSG_FW_PATHNAME
#ifndef AM65X
#define RPMSG_FW_PATHNAME "/lib/firmware/am64-main-r5f%d_%d-fw"
#else
#define RPMSG_FW_PATHNAME "/lib/firmware/am65x-mcu-r5f%d_%d-fw"
#endif
#endif

char commandBuffer[256];
char softLinkFormat[NUM_R5_APPS][256] = {
"ln -nsf "BENCHMARK_DEMO_FW_ROOT"/app_no_os_mcu%d_%d_cmsis_cfft.out "RPMSG_FW_PATHNAME,
"ln -nsf "BENCHMARK_DEMO_FW_ROOT"/app_no_os_mcu%d_%d_cmsis_fir.out "RPMSG_FW_PATHNAME,
"ln -nsf "BENCHMARK_DEMO_FW_ROOT"/app_no_os_mcu%d_%d_cmsis_foc.out "RPMSG_FW_PATHNAME,
"ln -nsf "BENCHMARK_DEMO_FW_ROOT"/app_no_os_mcu%d_%d_cmsis_pid.out "RPMSG_FW_PATHNAME,
"ln -nsf "BENCHMARK_DEMO_FW_ROOT"/app_no_os_mcu%d_%d_adc_pwm.out "RPMSG_FW_PATHNAME
};

long loopCounter = 0;

#define RPMSG_HEADER_LEN 16
#define MAX_RPMSG_BUFF_SIZE (512 - RPMSG_HEADER_LEN)
#define PAYLOAD_SIZE    12
#define PAYLOAD_MAX_SIZE    (MAX_RPMSG_BUFF_SIZE - 24)
#define RPMSG_BUS_SYS "/sys/bus/rpmsg"
#define REMOTE_ENDPT	14
#define DEVICE_NAME "rpmsg_chrdev"
#define FLAGS 0

long diff(struct timespec start, struct timespec end)
{
  struct timespec temp;

  if ((end.tv_nsec - start.tv_nsec) < 0) {
    temp.tv_sec = end.tv_sec - start.tv_sec-1;
    temp.tv_nsec = 1000000000UL + end.tv_nsec - start.tv_nsec;
  } else {
    temp.tv_sec = end.tv_sec - start.tv_sec;
    temp.tv_nsec = end.tv_nsec - start.tv_nsec;
  }

  return (temp.tv_sec * 1000000UL + temp.tv_nsec / 1000);
}

int send_msg(int fd, char *msg, int len)
{
    int ret = 0;

    ret = write(fd, msg, len);
    if (ret < 0) {
        perror("Can't write to rpmsg endpt device\n");
        return -1;
    }

    return ret;
}

int recv_msg(int fd, int len, char *reply_msg, int *reply_len)
{
    int ret = 0;

    /* Note: len should be max length of response expected */
    ret = read(fd, reply_msg, len);
    if (ret < 0) {
        perror("Can't read from rpmsg endpt device\n");
        return -1;
    } else {
        *reply_len = ret;
    }

    return 0;
}

static int jsoneq(const char *json, jsmntok_t *tok, const char *s) {
  if (tok->type == JSMN_STRING && (int)strlen(s) == tok->end - tok->start &&
    strncmp(json + tok->start, s, tok->end - tok->start) == 0) {
    return 0;
  }
  return -1;
}

char dataBuf[4096];
char dataBufNew[4096];
jsmn_parser p;
jsmntok_t tokenList[1024]; /* We expect no more than 1024 tokens */
FILE *fpIn, *fpOut;

int json_file_read(char *inFileName, char *buf, int size, jsmntok_t *token, int *tokenNum) 
{
  int bytes_read, r;

  memset(buf, 0, size);
  fpIn = fopen(inFileName, "r");
  bytes_read = fread(buf, 1, size, fpIn); 
  printf("Read %d bytes from %s\n", bytes_read, inFileName); 
  jsmn_init(&p);
  r = jsmn_parse(&p, buf, bytes_read, token, *tokenNum);
  if (r < 0) {
    printf("Failed to parse JSON: %d\n", r);
    return -1;
  }

  /* Assume the top-level element is an object */
  if (r < 1 || token[0].type != JSMN_OBJECT) {
    printf("Object expected\n");
    return -1;
  }

  fclose(fpIn);

  *tokenNum = r;
  return bytes_read;
}

int json_file_write(char *outFileName, char *buf, int size) 
{
  int bytes_write;

  fpOut = fopen(outFileName, "w");
  bytes_write = fwrite(buf, 1, size, fpOut);
  printf("Write %d bytes to oob_update.json\n", bytes_write); 
  fclose(fpOut);
  return bytes_write;
}

int json_read_fields(char *dataBuf, int size, jsmntok_t *t, int r, core_stat *myCoreStat, int num, core_output *myCoreOut)
{
  int i, j, k, l, m;
  char tempBuf[128];
  char tempNum[20];
  int cur;

  /* Looking for each R5 core */
  cur = 1;
  for (m=0; m<4; m++)
  {
next0:
    sprintf(tempBuf, "core%d", m);
    for (i = cur; i < r; i++) 
    {
      if (jsoneq(dataBuf, &t[i], tempBuf) == 0)
      {
        /* if we got coreN */
        i++;
        cur++;

        /* looking for input */
        for (j = cur; j < r; j++) 
        {
          if (jsoneq(dataBuf, &t[j], "input") == 0)
          {
            /* if we got intput */
            j++;
            cur++;

            /* looking for application */
            for (k = cur; k < r; k++) 
            {
              /* find application field */
              if (jsoneq(dataBuf, &t[k], "application") == 0)
              {
                /* if we got application */
                strncpy(tempNum, dataBuf + t[k + 1].start, t[k + 1].end - t[k + 1].start);
                tempNum[t[k + 1].end - t[k + 1].start] = '\0';
                myCoreStat[m].input.app = atoi(tempNum);
                k++;
              }

              /* find frequency field */
              if (jsoneq(dataBuf, &t[k], "frequency") == 0)
              {
                /* if we got frequency */
                strncpy(tempNum, dataBuf + t[k + 1].start, t[k + 1].end - t[k + 1].start);
                tempNum[t[k + 1].end - t[k + 1].start] = '\0';
                myCoreStat[m].input.freq = atoi(tempNum);
                k++;
              }

              /* find changed field */
              if (jsoneq(dataBuf, &t[k], "changed") == 0)
              {
                /* if we got changed */
                strncpy(tempNum, dataBuf + t[k + 1].start, t[k + 1].end - t[k + 1].start);
                tempNum[t[k + 1].end - t[k + 1].start] = '\0';
                myCoreStat[m].input.mod_flag = atoi(tempNum);
                k++;
                cur = k;
                goto next1;
              }
            } /* k loop */  
          } /* input */
        } /* j loop */

next1:
        /* looking for output */
        for (j = cur; j < r; j++) 
        {
          if (jsoneq(dataBuf, &t[j], "output") == 0)
          {
            /* if we got output */
            j++;
            cur++;

            /* looking for cpu_load */
            for (k = cur; k < r; k++) 
            {
              if (jsoneq(dataBuf, &t[k], "cpu_load") == 0)
              {
                /* if we got cpu_load */
                k++;
                cur++;

                /* looking for current, average and max */
                for (l = cur; l < r; l++) 
                {
                  /* find current field */
                  if (jsoneq(dataBuf, &t[l], "current") == 0)
                  {
                    /* if we got current */
                    strncpy(tempNum, dataBuf + t[l + 1].start, t[l + 1].end - t[l + 1].start);
                    tempNum[t[l + 1].end - t[l + 1].start] = '\0';
                    myCoreStat[m].output.cload.cur = atoi(tempNum);
                    l++;
                  }

                  /* find average field */
                  if (jsoneq(dataBuf, &t[l], "average") == 0)
                  {
                    /* if we got average */
                    strncpy(tempNum, dataBuf + t[l + 1].start, t[l + 1].end - t[l + 1].start);
                    tempNum[t[l + 1].end - t[l + 1].start] = '\0';
                    myCoreStat[m].output.cload.ave = atoi(tempNum);
                    l++;
                  }

                  /* find max field */
                  if (jsoneq(dataBuf, &t[l], "max") == 0)
                  {
                    /* if we got max */
                    strncpy(tempNum, dataBuf + t[l + 1].start, t[l + 1].end - t[l + 1].start);
                    tempNum[t[l + 1].end - t[l + 1].start] = '\0';
                    myCoreStat[m].output.cload.max = atoi(tempNum);
                    l++;
                    cur = l;
                    goto next2;
                  }
                } /* l loop */ 
              } /* cpu_load */
            } /* k loop */

next2:
            /* looking for int_latency */
            for (k = cur; k < r; k++) 
            {
              if (jsoneq(dataBuf, &t[k], "int_latency") == 0)
              {
                /* if we got int_latency */
                k++;
                cur++;

                /* looking for average and max */
                for (l = cur; l < r; l++) 
                {
                  /* find average field */
                  if (jsoneq(dataBuf, &t[l], "average") == 0)
                  {
                    /* if we got average */
                    strncpy(tempNum, dataBuf + t[l + 1].start, t[l + 1].end - t[l + 1].start);
                    tempNum[t[l + 1].end - t[l + 1].start] = '\0';
                    myCoreStat[m].output.ilate.ave = atoi(tempNum);
                    l++;
                  }

                  /* find max field */
                  if (jsoneq(dataBuf, &t[l], "max") == 0) 
                  {
                    /* if we got max */
                    strncpy(tempNum, dataBuf + t[l + 1].start, t[l + 1].end - t[l + 1].start);
                    tempNum[t[l + 1].end - t[l + 1].start] = '\0';
                    myCoreStat[m].output.ilate.max = atoi(tempNum);
                    l++;
                    cur = l;
                    goto next3;
                  }
                } /* l loop */
              } /* int_latency */  
            } /* k loop */

next3:
            /* looking for cycles_per_loop */
            for (k = cur; k < r; k++) 
            {
              if (jsoneq(dataBuf, &t[k], "cycles_per_loop") == 0)
              {
                /* if we got cycles_per_loop */
                k++;
                cur++;

                /* looking for average and max */
                for (l = k; l < r; l++) 
                {
                  /* find average field */
                  if (jsoneq(dataBuf, &t[l], "average") == 0)
                  {
                    /* if we got average */
                    strncpy(tempNum, dataBuf + t[l + 1].start, t[l + 1].end - t[l + 1].start);
                    tempNum[t[l + 1].end - t[l + 1].start] = '\0';
                    myCoreStat[m].output.ccploop.ave = atoi(tempNum);
                    l++;
                  }

                  /* find max field */
                  if (jsoneq(dataBuf, &t[l], "max") == 0)
                  {
                    /* if we got max */
                    strncpy(tempNum, dataBuf + t[l + 1].start, t[l + 1].end - t[l + 1].start);
                    tempNum[t[l + 1].end - t[l + 1].start] = '\0';
                    myCoreStat[m].output.ccploop.max = atoi(tempNum);
                    l++;
                    cur = l;
                    goto next4;
                  }
                } /* l loop */
              } /* cycles_per_loop */  
            } /* k loop */

next4:
            /* looking for sram */
            for (k = cur; k < r; k++) 
            {
              if (jsoneq(dataBuf, &t[k], "sram") == 0)
              {
                /* if we got sram */
                strncpy(tempNum, dataBuf + t[k + 1].start, t[k + 1].end - t[k + 1].start);
                tempNum[t[k + 1].end - t[k + 1].start] = '\0';
                myCoreStat[m].output.sram_pcnt = 100-atoi(tempNum);
                k++;
                cur = k;
                goto next0;
              } /* sram */
            }/* k loop */
          } /* output */ 
        } /* j loop */
      } /* coreN */
    } /* i loop */
  } /* m loop */

  for (i = cur; i < r; i++) 
  {
    if (jsoneq(dataBuf, &t[i], "a53") == 0)
    {
      /* if we got a53 */
      i++;
      cur++;

      /* looking for output */
      for (j = cur; j < r; j++) 
      {
        if (jsoneq(dataBuf, &t[j], "output") == 0)
        {
          /* if we got output */
          j++;
          cur++;

          /* looking for cpu_load */
          for (k = cur; k < r; k++) 
          {
            if (jsoneq(dataBuf, &t[k], "cpu_load") == 0)
            {
              /* if we got cpu_load */
              k++;
              cur++;

              /* looking for current, average and max */
              for (l = cur; l < r; l++) 
              {
                /* find current field */
                if (jsoneq(dataBuf, &t[l], "current") == 0)
                {
                  /* if we got current */
                  strncpy(tempNum, dataBuf + t[l + 1].start, t[l + 1].end - t[l + 1].start);
                  tempNum[t[l + 1].end - t[l + 1].start] = '\0';
                  myCoreOut->cload.cur = atoi(tempNum);
                  l++;
                }

                /* find average field */
                if (jsoneq(dataBuf, &t[l], "average") == 0)
                {
                  /* if we got average */
                  strncpy(tempNum, dataBuf + t[l + 1].start, t[l + 1].end - t[l + 1].start);
                  tempNum[t[l + 1].end - t[l + 1].start] = '\0';
                  myCoreOut->cload.ave = atoi(tempNum);
                  l++;
                }

                /* find max field */
                if (jsoneq(dataBuf, &t[l], "max") == 0)
                {
                  /* if we got max */
                  strncpy(tempNum, dataBuf + t[l + 1].start, t[l + 1].end - t[l + 1].start);
                  tempNum[t[l + 1].end - t[l + 1].start] = '\0';
                  myCoreOut->cload.max = atoi(tempNum);
                  l++;
                  cur = l;
                  goto next5;
                }
              } /* l loop */ 
            } /* cpu_load */
          } /* k loop */

next5:
          /* looking for int_latency */
          for (k = cur; k < r; k++) 
          {
            if (jsoneq(dataBuf, &t[k], "int_latency") == 0)
            {
              /* if we got int_latency */
              k++;
              cur++;

              /* looking for average and max */
              for (l = cur; l < r; l++) 
              {
                /* find average field */
                if (jsoneq(dataBuf, &t[l], "average") == 0)
                {
                  /* if we got average */
                  strncpy(tempNum, dataBuf + t[l + 1].start, t[l + 1].end - t[l + 1].start);
                  tempNum[t[l + 1].end - t[l + 1].start] = '\0';
                  myCoreOut->ilate.ave = atoi(tempNum);
                  l++;
                }

                /* find max field */
                if (jsoneq(dataBuf, &t[l], "max") == 0)
                {
                  /* if we got max */
                  strncpy(tempNum, dataBuf + t[l + 1].start, t[l + 1].end - t[l + 1].start);
                  tempNum[t[l + 1].end - t[l + 1].start] = '\0';
                  myCoreOut->ilate.max = atoi(tempNum);
                  l++;
                  cur = l;
                  goto next6;
                }
              } /* l loop */
            } /* int_latency */  
          } /* k loop */

next6:
          /* looking for cycles_per_loop */
          for (k = cur; k < r; k++) 
          {
            if (jsoneq(dataBuf, &t[k], "cycles_per_loop") == 0)
            {
              /* if we got cycles_per_loop */
              k++;
              cur++;

              /* looking for average and max */
              for (l = cur; l < r; l++) 
              {
                /* find average field */
                if (jsoneq(dataBuf, &t[l], "average") == 0)
                {
                  /* if we got average */
                  strncpy(tempNum, dataBuf + t[l + 1].start, t[l + 1].end - t[l + 1].start);
                  tempNum[t[l + 1].end - t[l + 1].start] = '\0';
                  myCoreOut->ccploop.ave = atoi(tempNum);
                  l++;
                }

                /* find max field */
                if (jsoneq(dataBuf, &t[l], "max") == 0)
                {
                  /* if we got max */
                  strncpy(tempNum, dataBuf + t[l + 1].start, t[l + 1].end - t[l + 1].start);
                  tempNum[t[l + 1].end - t[l + 1].start] = '\0';
                  myCoreOut->ccploop.max = atoi(tempNum);
                  l++;
                  cur = l;
                  goto next7;
                }
              } /* l loop */
            } /* cycles_per_loop */  
          } /* k loop */

next7:
          /* looking for sram */
          for (k = cur; k < r; k++) 
          {
            if (jsoneq(dataBuf, &t[k], "sram") == 0)
            {
              /* if we got sram */
              strncpy(tempNum, dataBuf + t[k + 1].start, t[k + 1].end - t[k + 1].start);
              tempNum[t[k + 1].end - t[k + 1].start] = '\0';
              myCoreOut->sram_pcnt = 100-atoi(tempNum);
              k++;
              cur = k;
              goto next8;
            } /* sram */
          }/* k loop */
        } /* output */ 
      } /* j loop */
    } /* coreN */
  } /* i loop */     

next8:
  return EXIT_SUCCESS;
}

int json_write_fields(char *outBuf, int bufSize, core_stat *coreStat, int num, core_output *coreOut) 
{
  int i;
  int index = 0;
  int numChar;

  /* output top level object { */
  sprintf(outBuf+index, "{\n");
  index += 2;

  /* output JSON for each core */
  for (i=0; i<num; i++)
  {
    /* output core object { */
    numChar = sprintf(outBuf+index, "  \"core%d\": {\n", i);
    index += numChar;

    /* output input object { */
    numChar = sprintf(outBuf+index, "    \"input\": {\n");
    index += numChar;
    /* output application field { */
    numChar = sprintf(outBuf+index, "      \"application\": %d,\n", coreStat[i].input.app);
    index += numChar;
    /* output frequency field { */
    numChar = sprintf(outBuf+index, "      \"frequency\": %d,\n", coreStat[i].input.freq);
    index += numChar;
    /* output changed field { */
    numChar = sprintf(outBuf+index, "      \"changed\": %d\n", coreStat[i].input.mod_flag);
    index += numChar;
    /* output input object } */
    numChar = sprintf(outBuf+index, "    },\n");
    index += numChar;

    /* output output object { */
    numChar = sprintf(outBuf+index, "    \"output\": {\n");
    index += numChar;
    /* output cpu_load object { */
    numChar = sprintf(outBuf+index, "      \"cpu_load\": {\n");
    index += numChar;
    /* output current field { */
    numChar = sprintf(outBuf+index, "        \"current\": %d,\n", coreStat[i].output.cload.cur);
    index += numChar;
    /* output average field { */
    numChar = sprintf(outBuf+index, "        \"average\": %d,\n", coreStat[i].output.cload.ave);
    index += numChar;
    /* output max field { */
    numChar = sprintf(outBuf+index, "        \"max\": %d\n", coreStat[i].output.cload.max);
    index += numChar;
    /* output cpu_load object } */
    numChar = sprintf(outBuf+index, "      },\n");
    index += numChar;

    /* output int_latency object { */
    numChar = sprintf(outBuf+index, "      \"int_latency\": {\n");
    index += numChar;
    /* output average field { */
    numChar = sprintf(outBuf+index, "        \"average\": %d,\n", coreStat[i].output.ilate.ave);
    index += numChar;
    /* output max field { */
    numChar = sprintf(outBuf+index, "        \"max\": %d\n", coreStat[i].output.ilate.max);
    index += numChar;
    /* output int_latency object } */
    numChar = sprintf(outBuf+index, "      },\n");
    index += numChar;

    /* output cycles_per_loop object { */
    numChar = sprintf(outBuf+index, "      \"cycles_per_loop\": {\n");
    index += numChar;
    /* output average field { */
    numChar = sprintf(outBuf+index, "        \"average\": %d,\n", coreStat[i].output.ccploop.ave);
    index += numChar;
    /* output max field { */
    numChar = sprintf(outBuf+index, "        \"max\": %d\n", coreStat[i].output.ccploop.max);
    index += numChar;
    /* output cycles_per_loop object } */
    numChar = sprintf(outBuf+index, "      },\n");
    index += numChar;

    /* output sram_label field { */
    numChar = sprintf(outBuf+index, "      \"sram_label\": \"OC-SRAM: %d%%\",\n", coreStat[i].output.sram_pcnt);
    index += numChar;
    /* output sram field { */
    numChar = sprintf(outBuf+index, "      \"sram\": %d\n", 100-coreStat[i].output.sram_pcnt);
    index += numChar;

    /* output output object } */
    numChar = sprintf(outBuf+index, "    }\n");
    index += numChar;

    /* output core object } */
    numChar = sprintf(outBuf+index, "  },\n");
    index += numChar;
  }

  /* output a53 object { */
  numChar = sprintf(outBuf+index, "  \"a53\": {\n");
  index += numChar;

  /* output output object { */
  numChar = sprintf(outBuf+index, "    \"output\": {\n");
  index += numChar;
  /* output cpu_load object { */
  numChar = sprintf(outBuf+index, "      \"cpu_load\": {\n");
  index += numChar;
  /* output current field { */
  numChar = sprintf(outBuf+index, "        \"current\": %d,\n", coreOut->cload.cur);
  index += numChar;
  /* output average field { */
  numChar = sprintf(outBuf+index, "        \"average\": %d,\n", coreOut->cload.ave);
  index += numChar;
  /* output max field { */
  numChar = sprintf(outBuf+index, "        \"max\": %d\n", coreOut->cload.max);
  index += numChar;
  /* output cpu_load object } */
  numChar = sprintf(outBuf+index, "      },\n");
  index += numChar;

  /* output int_latency object { */
  numChar = sprintf(outBuf+index, "      \"int_latency\": {\n");
  index += numChar;
  /* output average field { */
  numChar = sprintf(outBuf+index, "        \"average\": %d,\n", coreOut->ilate.ave);
  index += numChar;
  /* output max field { */
  numChar = sprintf(outBuf+index, "        \"max\": %d\n", coreOut->ilate.max);
  index += numChar;
  /* output int_latency object } */
  numChar = sprintf(outBuf+index, "      },\n");
  index += numChar;

  /* output cycles_per_loop object { */
  numChar = sprintf(outBuf+index, "      \"cycles_per_loop\": {\n");
  index += numChar;
  /* output average field { */
  numChar = sprintf(outBuf+index, "        \"average\": %d,\n", coreOut->ccploop.ave);
  index += numChar;
  /* output max field { */
  numChar = sprintf(outBuf+index, "        \"max\": %d\n", coreOut->ccploop.max);
  index += numChar;
  /* output cycles_per_loop object } */
  numChar = sprintf(outBuf+index, "      },\n");
  index += numChar;

  /* output sram_label field { */
  numChar = sprintf(outBuf+index, "      \"sram_label\": \"OC-SRAM: %d%%\",\n", coreOut->sram_pcnt);
  index += numChar;
  /* output sram field { */
  numChar = sprintf(outBuf+index, "      \"sram\": %d\n", 100-coreOut->sram_pcnt);
  index += numChar;

  /* output output object } */
  numChar = sprintf(outBuf+index, "    }\n");
  index += numChar;

  /* output a53 object } */
  numChar = sprintf(outBuf+index, "  }\n");
  index += numChar;

  /* output top level object } */
  numChar = sprintf(outBuf+index, "}\n");
  index += numChar;

  printf("Total %d bytes have output\n", index);

  return index;
}

char rpmsg_dev[256]="virtio0.rpmsg_chrdev.-1.14";
int main(int argc, char *argv[])
{
  int j, k;
  char jsonFilePath[256] = "/usr/share/sitara-benchmark-server/app/oob_data.jason";
  int token_num, bytesRead, bytesWrite, tempSize;

  struct timespec start, end;
  long elapsed;
  int *dataPtr;

  int ret = 0;
  int packet_len;
  char eptdev_name[32] = { 0 };
  char packet_buf[512] = { 0 };
  rpmsg_char_dev_t *rcdev;

  printf("\r\n RPMsg_char to JSON test start \r\n");
  
  /* do we have file path parameter */
  if ((argc==2)&&(strlen(argv[1])<256))
    strcpy(jsonFilePath, argv[1]);

  /* Load rpmsg_char driver */
  printf("\r\nMaster>probe rpmsg_char\r\n");
  ret = system("modprobe rpmsg_char");
  if (ret < 0) {
     perror("Failed to load rpmsg_char driver.\n");
     return -EINVAL;
  }

  /* read the JSON file */
  token_num = 1024;
  memset(R5CoreStat, 0, sizeof(R5CoreStat));
  memset(&A53CoreStat, 0, sizeof(A53CoreStat));
  memset(dataBuf, 0, 4096);
  memset(dataBufNew, 0, 4096);

  /* Use auto-detection for SoC */
  ret = rpmsg_char_init(NULL);
  if (ret) {
    printf("rpmsg_char_init failed, ret = %d\n", ret);
    return ret;
  }
  
  while (1)
  {
    /* read the JSON file and update the core stats */
    bytesRead = json_file_read(jsonFilePath, dataBuf, 4096, tokenList, &token_num);
#ifdef DEBUG_PRINT
    printf("%d bytes read and %d tokens parsed\n", bytesRead, token_num);
#endif

    /* update the core stats from JSON file */ 
    json_read_fields(dataBuf, bytesRead, tokenList, token_num, R5CoreStat, NUM_R5_CORES, &A53CoreStat);

    for (j=0; j<NUM_R5_CORES; j++)
    {
      /* update the curR5CoreInput[j] according the JSON file */
      /* if we have a new selection */
      if (R5CoreStat[j].input.mod_flag)
      {
#ifdef DEBUG_PRINT
        printf("mod_flag set for core %d\n", j);
#endif
        /* if we have a new app selection */
        /* if ((R5CoreStat[j].input.app!=curR5CoreInput[j].app)&&(j%2)) */
        if (0) /* bypass the app selection for now */
        {
            /* Stop the higher core in the cluster first */
#ifdef DEBUG_PRINT
            printf("Switch from %d to %d\n", R5CoreStat[j].input.app, curR5CoreInput[j].app);
#endif
            /* update the current app selection */
            curR5CoreInput[j].app = R5CoreStat[j].input.app;
            /* stop the app on R5 app on core j */
            sprintf(commandBuffer, "echo stop > /sys/class/remoteproc/remoteproc%d/state", j);
#ifdef DEBUG_PRINT
            printf("Stop: %s\n", commandBuffer);
#endif
            ret = system(commandBuffer);
            if (ret < 0) {
              printf("Failed to stop rpmsg_char driver.\n");
              return -EINVAL;
            }
            /* wait 1sec for the R5 application to stop */
            usleep(1000000);

            /* Stop the lower core in the cluster second */
#ifdef DEBUG_PRINT
            printf("Switch from %d to %d\n", R5CoreStat[j-1].input.app, curR5CoreInput[j-1].app);
#endif
            /* stop the app on R5 app on core j-1 */
            sprintf(commandBuffer, "echo stop > /sys/class/remoteproc/remoteproc%d/state", j-1);
#ifdef DEBUG_PRINT
            printf("Stop: %s\n", commandBuffer);
#endif
            ret = system(commandBuffer);
            if (ret < 0) {
              printf("Failed to stop rpmsg_char driver.\n");
              return -EINVAL;
            }
            /* wait 1sec for the R5 application to stop */
            usleep(1000000);

            /* Start the lower core in the cluster first */
            /* change the soft link for R5 core j-1 */
            sprintf(commandBuffer, softLinkFormat[curR5CoreInput[j-1].app-1], 1+((j-1)/2), (j-1)%2, 0+((j-1)/2), (j-1)%2);
#ifdef DEBUG_PRINT
            printf("Softlink: %s\n", commandBuffer);
#endif
            ret = system(commandBuffer);
            if (ret < 0) {
              printf("Failed to change soft link.\n");
              return -EINVAL;
            }
            ret = system("sync");
            if (ret < 0) {
              printf("Failed to change soft link.\n");
              return -EINVAL;
            }
            /* wait 1sec for the softlink to get ready */
            usleep(1000000);

            /* load and start the R5 app on core j-1 */
            sprintf(commandBuffer, "echo start > /sys/class/remoteproc/remoteproc%d/state", j-1);
#ifdef DEBUG_PRINT
            printf("Start: %s\n", commandBuffer);
#endif
            ret = system(commandBuffer);
            if (ret < 0) {
              printf("Failed to start rpmsg_char driver.\n");
              return -EINVAL;
            }
            /* wait 1sec for the R5 application to get ready */
            usleep(1000000);

            /* Start the higher core in the cluster second */
            /* change the soft link for R5 core j */
            sprintf(commandBuffer, softLinkFormat[curR5CoreInput[j].app-1], 1+(j/2), j%2, 0+(j/2), j%2);
#ifdef DEBUG_PRINT
            printf("Softlink: %s\n", commandBuffer);
#endif
            ret = system(commandBuffer);
            if (ret < 0) {
              printf("Failed to change soft link.\n");
              return -EINVAL;
            }
            ret = system("sync");
            if (ret < 0) {
              printf("Failed to change soft link.\n");
              return -EINVAL;
            }
            /* wait 1sec for the softlink to get ready */
            usleep(1000000);

            /* load and start the R5 app on core j */
            sprintf(commandBuffer, "echo start > /sys/class/remoteproc/remoteproc%d/state", j);
#ifdef DEBUG_PRINT
            printf("Start: %s\n", commandBuffer);
#endif
            ret = system(commandBuffer);
            if (ret < 0) {
              printf("Failed to start rpmsg_char driver.\n");
              return -EINVAL;
            }

            /* wait 1sec for the R5 application to get ready */
            usleep(1000000);
        }

        /* if we have a new app selection */
        if (R5CoreStat[j].input.freq!=curR5CoreInput[j].freq)
        {
            /* update the current app selection */
            curR5CoreInput[j].freq = R5CoreStat[j].input.freq;
        }

        /* if ((R5CoreStat[j].input.app!=curR5CoreInput[j].app)&&((j&0x1)==0)) */
        if (R5CoreStat[j].input.app!=curR5CoreInput[j].app)
        {
            /* update the current app selection */
            curR5CoreInput[j].app = R5CoreStat[j].input.app;
            continue;
        }
      }

      /*
       * Open the remote rpmsg device identified by dev_name and bind the
       * device to a local end-point used for receiving messages from
       * remote processor
      */
      sprintf(eptdev_name, "rpmsg-char-%d-%d", j, getpid());
#ifdef AM65X
      rcdev = rpmsg_char_open(R5F_MCU0_0+j, DEVICE_NAME, RPMSG_ADDR_ANY, 
                REMOTE_ENDPT, eptdev_name, FLAGS);
#else
      rcdev = rpmsg_char_open(R5F_MAIN0_0+j, DEVICE_NAME, RPMSG_ADDR_ANY,
                REMOTE_ENDPT, eptdev_name, FLAGS);
#endif
      if (!rcdev) {
        perror("Can't create an endpoint device");
        return -1;
      }

#ifdef DEBUG_PRINT
      printf("Created endpt device %s, fd = %d port = %d\n", eptdev_name,
      rcdev->fd, rcdev->endpt);      /* update the RPMgs_char device name */
#endif

      /* Copy the curR5CoreInput[j].input into the sending data buffer. */
      packet_len = PAYLOAD_SIZE;
      memcpy((char *)packet_buf, &curR5CoreInput[j].app, packet_len);
      
      clock_gettime(CLOCK_REALTIME, &start);

      ret = send_msg(rcdev->fd, (char *)packet_buf, packet_len);
      if (ret < 0) {
        printf("send_msg failed, ret = %d\n", ret);
        return -1;
      }
      if (ret != packet_len) {
        printf("bytes written does not match send request, ret = %d, packet_len = %d\n",
                ret, packet_len);
        return -1;
      }

#ifdef DEBUG_PRINT
      printf("Sent message to core%d: size=%d\n", j, packet_len);
      /* print out sent data size */
      dataPtr = (int *)packet_buf;
      for (k = 0; k < packet_len/sizeof(int); k++) {
        printf("to_%d_%d->0x%08x\n", j, k, *dataPtr++);
      }
      printf("\n");
#endif

      ret = recv_msg(rcdev->fd, 256, (char *)packet_buf, &packet_len);
      if (ret < 0) {
        printf("recv_msg failed for iteration %d, ret = %d\n", ret);
        return -1;
      }

#ifdef DEBUG_PRINT
      printf("Receided message from core%d: size=%d\n", j, packet_len);
      /* print out received data size */
      dataPtr = (int *)packet_buf;
      for (k = 0; k < packet_len/sizeof(int); k++) {
        printf("from_%d_%d->0x%08x\n", j, k, *dataPtr++);
      }
      printf("\n");
#endif

      clock_gettime(CLOCK_REALTIME, &end);
      elapsed = diff(start, end);

      /* save the RPMsg data in R5CoreStat[] */
      memcpy(&R5CoreStat[j], (char *)packet_buf, packet_len);

      printf("Avg round trip time: %ld usecs\n", elapsed);

      ret = rpmsg_char_close(rcdev);
      if (ret < 0) {
        printf("rpmsg_char_close() failed\n");
        return -1;
      }
    }

    /* Generate JSON file using the core stats */
    bytesRead = json_write_fields(dataBufNew, 4096, R5CoreStat, NUM_R5_CORES, &A53CoreStat);
    bytesWrite = json_file_write(jsonFilePath, dataBufNew, bytesRead);
    
    /* sleep for 2 sec */
    usleep(2000000);

  } /* while loop */
  return 0;
}
