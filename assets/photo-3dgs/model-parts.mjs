const MAX_PART_BYTES = 24 * 1024 * 1024;

export async function loadModelParts(manifestURL, onProgress = () => {}) {
  const response = await fetch(manifestURL);
  if (!response.ok) throw new Error(`模型清单加载失败 (${response.status})。`);
  const manifest = await response.json();
  const parts = manifest.parts;
  if (manifest.version !== 1 || !Array.isArray(parts) || !parts.length || parts.length > 16 ||
      !Number.isSafeInteger(manifest.byteLength) || manifest.byteLength <= 0 ||
      parts.some(part => !/^[\w.-]+\.bin$/.test(part.file) ||
        !Number.isSafeInteger(part.byteLength) || part.byteLength <= 0 ||
        part.byteLength > MAX_PART_BYTES || !/^[a-f0-9]{64}$/.test(part.sha256)) ||
      parts.reduce((sum, part) => sum + part.byteLength, 0) !== manifest.byteLength) {
    throw new Error('模型清单格式或文件大小不正确。');
  }

  // Reassemble the original PLY bytes; do not transform any Gaussian attributes.
  const buffers = [];
  let downloaded = 0;
  onProgress(0);
  for (const part of parts) {
    const partResponse = await fetch(new URL(part.file, manifestURL));
    if (!partResponse.ok) throw new Error(`模型分片加载失败 (${partResponse.status})。`);
    const buffer = await partResponse.arrayBuffer();
    if (buffer.byteLength !== part.byteLength) throw new Error('模型分片不完整，请重新加载。');
    const digest = await crypto.subtle.digest('SHA-256', buffer);
    const sha256 = Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('');
    if (sha256 !== part.sha256) throw new Error('模型分片校验失败，请重新加载。');
    buffers.push(buffer);
    downloaded += buffer.byteLength;
    onProgress(downloaded / manifest.byteLength * 100);
  }
  return new Blob(buffers, {type: 'application/octet-stream'});
}
