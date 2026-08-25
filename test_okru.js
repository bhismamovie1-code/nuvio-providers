async function extractOkru(url) {
  const res = await fetch(url.startsWith('//') ? `https:${url}` : url);
  const text = await res.text();
  const match = text.match(/data-options="([^"]+)"/);
  if (!match) {
    console.log('No data-options found');
    return [];
  }
  
  // HTML entity decoding for quotes
  const jsonStr = match[1].replace(/&quot;/g, '"');
  try {
    const data = JSON.parse(jsonStr);
    const metadataStr = data.flashvars.metadata;
    const metadata = JSON.parse(metadataStr);
    console.log(metadata.videos);
  } catch(e) {
    console.error(e);
  }
}
extractOkru('https://ok.ru/videoembed/5934797752884');
