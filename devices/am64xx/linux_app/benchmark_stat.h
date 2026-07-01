/**
 * benchmark_stat.h
 * Copyright (c) 2020, Texas Instruments Incorporated
 * All rights reserved.
 *
 * Redistribution and use in source and binary forms, with or without
 * modification, are permitted provided that the following conditions
 * are met:
 *
 * *  Redistributions of source code must retain the above copyright
 *    notice, this list of conditions and the following disclaimer.
 *
 * *  Redistributions in binary form must reproduce the above copyright
 *    notice, this list of conditions and the following disclaimer in the
 *    documentation and/or other materials provided with the distribution.
 *
 * *  Neither the name of Texas Instruments Incorporated nor the names of
 *    its contributors may be used to endorse or promote products derived
 *    from this software without specific prior written permission.
 *
 * THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS"
 * AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO,
 * THE IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR
 * PURPOSE ARE DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT OWNER OR
 * CONTRIBUTORS BE LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL,
 * EXEMPLARY, OR CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT LIMITED TO,
 * PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES; LOSS OF USE, DATA, OR PROFITS;
 * OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND ON ANY THEORY OF LIABILITY,
 * WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT (INCLUDING NEGLIGENCE OR
 * OTHERWISE) ARISING IN ANY WAY OUT OF THE USE OF THIS SOFTWARE,
 * EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
 * */
/* =================================================================================
File name:       benchmark_stat.h
===================================================================================*/

#include <stdint.h>

#ifndef _BENCHMARK_STAT_H_
#define _BENCHMARK_STAT_H_

#define NUM_CORES             4
#define NUM_APPS              5
#define NUM_OPTIONS           4
#define NUM_CFFT_SIZE         4

/*!
 *  @brief    Application Selection for R5 benchmarks
 */
typedef enum App_Sel_e {
    APP_SEL_DEF             = 0,
    APP_SEL_CFFT            = 1,
    APP_SEL_FIR             = 2,
    APP_SEL_FOC             = 3,
    APP_SEL_PID             = 4,
    APP_SEL_ADC             = 5
} App_Sel;

/*!
 *  @brief    Running Frequencies Selection for R5 benchmarks
 */
typedef enum Run_Freq_Sel_e {
    RUN_FREQ_SEL_DEF         = 0,
    RUN_FREQ_SEL_1          = 1,
    RUN_FREQ_SEL_2          = 2,
    RUN_FREQ_SEL_3          = 3,
    RUN_FREQ_SEL_4          = 4
} Run_Freq_Sel;

/*!
 *  @brief    Running Frequencies for R5 benchmarks
 */
typedef enum Run_Freq_e {
    RUN_FREQ_DEF         = 0,
    RUN_FREQ_1K          = 1000,
    RUN_FREQ_2K          = 2000,
    RUN_FREQ_4K          = 4000,
    RUN_FREQ_8K          = 8000,
    RUN_FREQ_10K         = 10000,
    RUN_FREQ_16K         = 16000,
    RUN_FREQ_20K         = 20000,
    RUN_FREQ_32K         = 32000,
    RUN_FREQ_40K         = 40000,
    RUN_FREQ_50K         = 50000,
    RUN_FREQ_100K        = 100000,
    RUN_FREQ_160K        = 160000,
    RUN_FREQ_250K        = 250000
} Run_Freq;

/*!
 *  @brief    CFFT data size Selection for R5 benchmarks
 */
typedef enum Cfft_Size_Sel_e {
    CFFT_SIZE_SEL_DEF        = 0,
    CFFT_SIZE_SEL_128        = 1,
    CFFT_SIZE_SEL_256        = 2,
    CFFT_SIZE_SEL_512        = 3,
    CFFT_SIZE_SEL_1024       = 4
} Cfft_Size_Sel;

/*!
 *  @brief    CFFT data sizes for R5 benchmarks
 */
typedef enum Cfft_Size_e {
    CFFT_SIZE_DEF            = 0,
    CFFT_SIZE_128            = 128,
    CFFT_SIZE_256            = 256,
    CFFT_SIZE_512            = 512,
    CFFT_SIZE_1024           = 1024
} Cfft_Size;

typedef struct
{
    int32_t app;      /* Input: application number (0-5: 0: none, 1:cfft, 2:fir, 3:foc, 4:pid, 5:ADC/ePWM) */
    int32_t freq;     /* Input: application running frequency (0-4: 0: none, 1:8Khz, 2:16Khz, 3:32Khz, 4:50Khz) */
    int32_t mod_flag; /* Input: modification flag (0/1) */
} core_input;

typedef struct
{
    int32_t cur;  /* Output: current CPU load (0-100) */
    int32_t ave;  /* Output: average CPU laod (0-100) */
    int32_t max;  /* Output: max CPU laod (0-100) */
} cpu_load;

typedef struct
{
    int32_t ave;  /* Output: average timer interrupt latency (0-10000 us) */
    int32_t max;  /* Output: max timer interrupt latency (0-10000 us) */
} int_latency;

typedef struct
{
    int32_t ave;  /* Output: average cycle count per loop (0-2^32) */
    int32_t max;  /* Output: max cycle count per loop (0-2^32) */
} ccp_loop;

typedef struct
{
    cpu_load cload;      /* Output: CPU load struct */
    int_latency ilate;   /* Output: INT latency struct */
    ccp_loop ccploop;    /* Output: circle count per loop struct */
    int64_t ave_count;       /* Output: counter for average period  */
    int32_t sram_pcnt;       /* Output: SRAM usage in percent (0-100) */
    int32_t core_num;        /* Output: current core ID (0-3) */
    int32_t app;             /* Output: current app (0-3) */
    int32_t freq;            /* Output: current freq (0-3) */
} core_output;

typedef struct
{
    core_input input;    /* core input parameters */
    core_output output;  /* core input parameters */
} core_stat;

typedef struct
{
    core_input input;    /* core input parameters */
} core_stat_rcv;

extern core_stat gCoreStat;
extern int32_t gCountPerLoopMax;
extern int32_t gCountPerLoopAve;

extern core_stat_rcv gCoreStatRcv;
extern uint16_t gCoreStatRcvSize;
extern uint32_t gAppSelect;
extern uint32_t gOptionSelect;
extern uint32_t gOption[];
extern uint32_t gAppRunFreq;

#endif /* _BENCHMARK_STAT_H_ */
