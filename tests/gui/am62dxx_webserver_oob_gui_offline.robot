Language: English

*** Settings ***
Documentation     GUI automation for the AM62D WebServer OOB Demo portal, run in offline/MOCK
...               mode (server.js started locally with MOCK=1 - no board required). Exercises
...               navigation, demo lifecycle, the native-dialog demo-switch confirmation, the
...               model-loading indicator, and the AI Model Inspector, all against synthetic
...               data. Complements am62dxx_webserver_oob_gui_evm.robot, which drives the same
...               GUI against real hardware.
Suite Setup       START WEBSERVER OOB DEMO OFFLINE
Suite Teardown    STOP WEBSERVER OOB DEMO OFFLINE
Resource          am62dxx_webserver_oob_gui.resource

*** Test Cases ***
AM62D_WEBSERVER_OOB_GUI_OFFLINE_CONNECTION_INDICATOR_AND_NAVIGATION
    [Documentation]    Verifies the connection indicator reports Connected against the mock
    ...    backend and that every sidebar nav item navigates to its page.
    ...
    [Tags]    AM62D    WEBSERVER_OOB    GUI    OFFLINE
    Browser.Get Text    ${SEL_CONN_TXT}    ==    Connected to AM62D EVM
    NAVIGATE TO PAGE    Audio Intelligence
    Browser.Get Url    contains    /audio-dsp
    NAVIGATE TO PAGE    DSP Acceleration
    Browser.Get Url    contains    /dsp-compute
    NAVIGATE TO PAGE    AI Model Inspector
    Browser.Get Url    contains    /model-inspector
    NAVIGATE TO PAGE    Logs
    Browser.Get Url    contains    /logs
    NAVIGATE TO PAGE    Home
    Browser.Get Url    contains    /home

AM62D_WEBSERVER_OOB_GUI_OFFLINE_DSP_COMPUTE_SIGCHAIN_BIQUAD_DEMO_LIFECYCLE
    [Documentation]    Runs the Sigchain Biquad EQ demo on the DSP Acceleration page against the
    ...    mock backend and confirms the status text reflects a connected mock run.
    ...
    [Tags]    AM62D    WEBSERVER_OOB    GUI    OFFLINE
    NAVIGATE TO PAGE    DSP Acceleration
    SELECT DEMO    Sigchain Biquad EQ
    WAIT FOR DEMO STATUS TEXT    Ready    timeout=10s
    RUN ACTIVE DEMO
    WAIT FOR DEMO HEADER BUTTON TEXT    Stop Demo
    WAIT FOR DEMO STATUS TEXT    Connected    timeout=15s
    STOP ACTIVE DEMO
    WAIT FOR DEMO HEADER BUTTON TEXT    Run Demo

AM62D_WEBSERVER_OOB_GUI_OFFLINE_MODEL_INSPECTOR_LIST_AND_UPLOAD_DIALOG
    [Documentation]    Verifies the AI Model Inspector lists the built-in GCRN model card and
    ...    that opening the upload dialog exposes the drop zone and Model Name/Task Type
    ...
    [Tags]    AM62D    WEBSERVER_OOB    GUI    OFFLINE
    NAVIGATE TO PAGE    AI Model Inspector
    Browser.Reload
    Browser.Wait For Elements State    ${SEL_MODEL_CARD}:has-text("GCRN")    visible    timeout=30s
    Browser.Click    button:has-text("Upload")
    Browser.Wait For Elements State    ${SEL_DROP_ZONE}    visible
    Browser.Wait For Elements State    input[placeholder="e.g. MobileNet v2"]    visible
    Browser.Wait For Elements State    text=Task Type    visible
    Browser.Click    .upload-card button:has(.mdi-close)
    Browser.Wait For Elements State    .upload-card    hidden    timeout=5s

AM62D_WEBSERVER_OOB_GUI_OFFLINE_MODEL_INSPECTOR_REFRESH_AND_UPLOAD_FLOW
    [Documentation]    Exercises the AI Model Inspector Refresh button and the full model-upload
    ...    flow (file input, Model Name/Task Type, submit).
    ...
    [Tags]    AM62D    WEBSERVER_OOB    GUI
    [Teardown]    OS.Remove File    ${DEMO_ROOT}/common/app/Model-Inspector/sample_model.html
    ${sample_file}=    Set Variable    ${OUTPUT_DIR}/sample_model.html
    OS.Create File    ${sample_file}    <html><body>Sample Model Inspector export</body></html>
    NAVIGATE TO PAGE    AI Model Inspector
    Browser.Reload
    Browser.Wait For Elements State    ${SEL_MODEL_CARD} >> nth=0    visible    timeout=15s
    ${count_before}=    Browser.Get Element Count    ${SEL_MODEL_CARD}
    CLICK MODEL INSPECTOR REFRESH
    Browser.Wait For Elements State    ${SEL_MI_REFRESH_BTN}    enabled    timeout=10s
    UPLOAD MODEL FILE    ${sample_file}    Sample Uploaded Model    Audio Classification
    Browser.Wait For Elements State    .upload-card    hidden    timeout=5s
    Browser.Wait For Elements State    ${SEL_MODEL_CARD}:has-text("Sample Uploaded Model")    visible    timeout=10s
    ${count_after}=    Browser.Get Element Count    ${SEL_MODEL_CARD}
    Should Be True    ${count_after} > ${count_before}

AM62D_WEBSERVER_OOB_GUI_OFFLINE_APP_SHELL_THEME_TOGGLE
    [Documentation]    Verifies the app-bar dark/light theme toggle (App.vue toggleTheme()) swaps
    ...    the weather icon each click and round-trips back to its starting state.
    ...
    [Tags]    AM62D    WEBSERVER_OOB    GUI    OFFLINE
    NAVIGATE TO PAGE    Home
    ${theme1}=    TOGGLE THEME
    ${theme2}=    TOGGLE THEME
    Should Not Be Equal As Strings    ${theme1}    ${theme2}

AM62D_WEBSERVER_OOB_GUI_OFFLINE_APP_SHELL_DEVICE_INFO_DIALOG
    [Documentation]    Verifies the "Device Info" sidebar item opens a dialog listing
    ...    Device/Board/SoC/IP Address/Port/Uptime rows, and that the close button dismisses it.
    ...
    [Tags]    AM62D    WEBSERVER_OOB    GUI
    NAVIGATE TO PAGE    Home
    OPEN DEVICE INFO DIALOG
    Browser.Get Text    ${SEL_DEVICE_INFO_DIALOG}    contains    Device
    Browser.Get Text    ${SEL_DEVICE_INFO_DIALOG}    contains    IP Address
    Browser.Get Text    ${SEL_DEVICE_INFO_DIALOG}    contains    Uptime
    CLOSE DEVICE INFO DIALOG

AM62D_WEBSERVER_OOB_GUI_OFFLINE_HOME_HERO_AND_DEMO_CARD_NAVIGATION
    [Documentation]    Verifies the Home page hero CTA and the first "Explore Demos And Tools"
    ...    card both navigate away from /home.
    ...
    [Tags]    AM62D    WEBSERVER_OOB    GUI    OFFLINE
    NAVIGATE TO PAGE    Home
    CLICK HOME HERO BUTTON
    Browser.Get Url    not contains    /home
    NAVIGATE TO PAGE    Home
    CLICK DEMO CARD BY INDEX    0
    Browser.Get Url    not contains    /home

AM62D_WEBSERVER_OOB_GUI_OFFLINE_LOGS_TOOLBAR_FILTER_REFRESH_PAUSE_AND_SAVE
    [Documentation]    Exercises the Logs page toolbar: Refresh (no error banner), the filter
    ...    input's "no matches" state and its clear button, Pause/Resume auto-refresh, and Save
    ...    to File (verifies a real .txt download) - Save to File is skipped if this host's
    ...    journal happens to be empty, since Logs.vue disables that button when there are no
    ...    lines to save.
    ...
    [Tags]    AM62D    WEBSERVER_OOB    GUI    OFFLINE
    NAVIGATE TO PAGE    Logs
    CLICK LOGS REFRESH
    Browser.Wait For Elements State    .log-panel    visible    timeout=10s
    ${errors}=    Browser.Get Element Count    .log-error
    Should Be Equal As Integers    ${errors}    0
    SET LOGS FILTER    zzz_no_such_log_line_zzz
    Browser.Wait For Elements State    text=No lines match the filter.    visible    timeout=5s
    CLEAR LOGS FILTER
    Browser.Get Text    ${SEL_LOGS_FILTER_INPUT}    ==    ${EMPTY}
    ${resume_text}=    Browser.Get Text    .ph-actions button:has-text("Pause"), .ph-actions button:has-text("Resume")
    TOGGLE LOGS AUTO REFRESH
    Browser.Wait For Elements State    .ph-actions button:has-text("${resume_text}")    hidden    timeout=5s
    TOGGLE LOGS AUTO REFRESH
    ${line_count}=    Browser.Get Element Count    ${SEL_LOGS_LINE}
    IF    ${line_count} > 0
        ${download}=    SAVE LOGS TO FILE AND WAIT
        Should Contain    ${download}[suggestedFilename]    webserver-oob-logs-
    ELSE
        Browser.Wait For Elements State    .ph-actions button:has-text("Save to File")    disabled
    END

AM62D_WEBSERVER_OOB_GUI_OFFLINE_HOME_INFO_AND_RUNTIME_CARDS_PRESENT
    [Documentation]    Verifies the Home page's Info card (SDK/MCU+ SDK/TIDL versions) and the
    ...    Device Info + Runtime Status card labels are present against the mock backend. Checks
    ...    presence only, not real (non "—") values, since MOCK responses for /device-info may
    ...    leave some fields blank.
    ...
    [Tags]    AM62D    WEBSERVER_OOB    GUI    OFFLINE
    NAVIGATE TO PAGE    Home
    Browser.Wait For Elements State    text="SDK Version"    visible    timeout=10s
    Browser.Wait For Elements State    text=Runtime Status    visible
    Browser.Wait For Elements State    text="MCU+ SDK Version"    visible
    Browser.Wait For Elements State    text="TIDL Version"    visible
