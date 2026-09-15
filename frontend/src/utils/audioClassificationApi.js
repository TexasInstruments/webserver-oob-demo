function asDevice(item) {
  if (typeof item === 'string') {
    const [value, ...labelParts] = item.split('|')
    const normalizedValue = value.trim()
    return {
      value: normalizedValue,
      label: (labelParts.join('|') || normalizedValue).trim(),
    }
  }

  const value = item?.id || item?.value || ''
  return {
    value,
    label: item?.name || item?.label || value,
  }
}

export function normalizeAudioDevices(payload) {
  const list = typeof payload === 'string'
    ? payload.split(/\r?\n/).map(line => line.trim()).filter(Boolean)
    : (Array.isArray(payload) ? payload : payload?.devices || [])

  return list
    .filter(item => {
      if (typeof item !== 'string') return Boolean(item)
      return !/^(error|no audio)/i.test(item)
    })
    .map(asDevice)
    .filter(device => device.value)
}

async function responseError(response, action) {
  let detail = ''
  try { detail = (await response.text()).trim() } catch (_) {}
  return new Error(detail || `${action} failed with HTTP ${response.status}`)
}

export async function getAudioDevices(fetchImpl = globalThis.fetch) {
  const response = await fetchImpl('/audio-devices')
  if (!response.ok) throw await responseError(response, 'Loading audio devices')

  const contentType = response.headers?.get?.('content-type') || ''
  const payload = contentType.includes('application/json')
    ? await response.json()
    : await response.text()
  return normalizeAudioDevices(payload)
}

export async function getAudioClassificationInfo(fetchImpl = globalThis.fetch) {
  const response = await fetchImpl('/audio-classification/info')
  if (!response.ok) throw await responseError(response, 'Loading audio classification information')
  return response.json()
}

export async function uploadAudioClassificationFile(file, fetchImpl = globalThis.fetch) {
  if (!file) throw new Error('Select a WAV file to upload')
  const response = await fetchImpl(
    `/upload-audio-classification-file?filename=${encodeURIComponent(file.name)}`,
    { method: 'POST', headers: { 'Content-Type': 'audio/wav' }, body: file }
  )
  if (!response.ok) throw await responseError(response, 'Uploading WAV file')
  return response.json()
}

export async function getAudioClassificationModels(fetchImpl = globalThis.fetch) {
  try {
    const response = await fetchImpl('/audio-classification/models')
    if (!response.ok) return { models: {}, default: 'yamnet' }
    return response.json()
  } catch (_) { return { models: {}, default: 'yamnet' } }
}

export async function startAudioClassification(device, model, fetchImpl = globalThis.fetch) {
  if (!device) throw new Error('Select an audio source before starting the demo')
  const params = new URLSearchParams({ device: String(device) })
  if (model) params.set('model', model)
  const response = await fetchImpl(`/start-audio-classification?${params}`)
  if (!response.ok) throw await responseError(response, 'Starting audio classification')
  return response.text()
}

export async function stopAudioClassification(fetchImpl = globalThis.fetch) {
  const response = await fetchImpl('/stop-audio-classification')
  if (!response.ok) throw await responseError(response, 'Stopping audio classification')
  return response.text()
}
