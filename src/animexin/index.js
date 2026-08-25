const cheerio = require('cheerio-without-node-native')

const MAIN_URL = 'https://animexin.dev'
const HEADERS = {
  'User-Agent':
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0.0.0 Safari/537.36',
  Referer: `${MAIN_URL}/`,
}

async function fetchText(url, options = {}) {
  const finalUrl = url.startsWith('http') ? url : `${MAIN_URL}${url}`
  try {
    const response = await fetch(finalUrl, {headers: HEADERS, ...options})
    if (!response.ok) return ''
    return await response.text()
  } catch (e) {
    return ''
  }
}

async function getKitsuData(idParam) {
  const match = String(idParam).match(/\d+/);
  if (!match) return null;
  const numericId = parseInt(match[0], 10);

  try {
    const res = await fetch(`https://kitsu.io/api/edge/anime/${numericId}`, {
      headers: {
        'Accept': 'application/vnd.api+json',
        'Content-Type': 'application/vnd.api+json'
      }
    });
    return await res.json();
  } catch (e) {
    console.error('[Animexin] Kitsu API Error:', e.message);
    return null;
  }
}

// Kitsu naturally handles absolute episode numbering for Anime.
function getKitsuAbsoluteEpisode(idParam, season, episode) {
  return episode;
}

async function searchAnimexin(searchQuery, mediaType) {
  const searchUrl = `/?s=${encodeURIComponent(searchQuery)}`
  const searchHtml = await fetchText(searchUrl)
  if (!searchHtml) return null

  const $search = cheerio.load(searchHtml)
  let seriesUrl = null

  $search('.bsx').each((i, el) => {
    const title = $search(el).find('.tt h2').text().trim() || $search(el).find('a').attr('title');
    const href = $search(el).find('a').attr('href')
    const typeText = $search(el).find('.typez').text().toLowerCase();

    // Skip movies if we are looking for a TV show
    if (mediaType === 'tv' && typeText.includes('movie')) return;

    if (!seriesUrl) seriesUrl = href; // fallback

    // Better match
    if (title && title.toLowerCase().includes(searchQuery.toLowerCase())) {
      seriesUrl = href;
      return false; // Break loop
    }
  })

  return seriesUrl;
}

async function getEpisodeUrl(seriesUrl, targetEpisode) {
  const seriesHtml = await fetchText(seriesUrl)
  const $series = cheerio.load(seriesHtml)
  let episodeUrl = null

  $series('.eplister ul li a').each((i, el) => {
    const epNumText = $series(el).find('.epl-num').text() || $series(el).text()
    const match = epNumText.match(/Episode\s*(\d+)/i) || epNumText.match(/\b(\d+)\b/)
    
    if (match) {
      const parsedNum = parseInt(match[1], 10);
      if (parsedNum === targetEpisode) {
        episodeUrl = $series(el).attr('href')
      }
    }
  })

  return episodeUrl;
}

async function extractOkru(url) {
  const res = await fetch(url.startsWith('//') ? `https:${url}` : url);
  const text = await res.text();
  const match = text.match(/data-options="([^"]+)"/);
  if (!match) return [];
  
  const jsonStr = match[1].replace(/&quot;/g, '"');
  try {
    const data = JSON.parse(jsonStr);
    const metadataStr = data.flashvars.metadata;
    const metadata = JSON.parse(metadataStr);
    return metadata.videos.map(v => ({
      quality: v.name,
      url: v.url
    }));
  } catch(e) {
    return [];
  }
}

async function extractDailymotion(url) {
  try {
    const videoIdMatch = url.match(/\/video\/([a-zA-Z0-9]+)/);
    if (!videoIdMatch) return [];
    
    const videoId = videoIdMatch[1];
    const metadataUrl = `https://www.dailymotion.com/player/metadata/video/${videoId}`;
    const res = await fetch(metadataUrl);
    const json = await res.json();
    
    if (json.qualities && json.qualities.auto && json.qualities.auto[0]) {
      return [{ quality: 'Auto', url: json.qualities.auto[0].url }];
    }
  } catch(e) {
    console.error('[Dailymotion] Extractor error:', e.message);
  }
  return [];
}

async function extractAllStreams(episodeUrl, animeTitle, absoluteEpisode) {
  const episodeHtml = await fetchText(episodeUrl)
  const $ep = cheerio.load(episodeHtml)
  const streams = []

  // Create an array of promises so we can resolve all extractors in parallel
  const extractionPromises = [];

  $ep('.mobius select option, #server option, .server option, .mobius .mirror option').each((i, el) => {
    const val = $ep(el).attr('value')
    const serverName = $ep(el).text().trim()

    // Skip empty or placeholder options
    if (val && serverName && serverName.toLowerCase() !== 'select video server' && serverName !== 'Choose Server') {
      try {
        const decoded = typeof atob !== 'undefined' ? atob(val) : Buffer.from(val, 'base64').toString('utf-8')
        let videoUrl = null

        if (decoded.startsWith('http')) {
          videoUrl = decoded;
        } else {
          const $iframe = cheerio.load(decoded)
          videoUrl = $iframe('iframe').attr('src')
        }

        if (videoUrl) {
          const sName = serverName.toLowerCase();
          // Route to specific extractors
          if (sName.includes('ok.ru') || videoUrl.includes('ok.ru')) {
            extractionPromises.push(
              extractOkru(videoUrl).then(okruStreams => {
                okruStreams.forEach(s => {
                  // Map OK.ru quality names to standard resolutions
                  let mappedQuality = 'auto';
                  const q = s.quality.toLowerCase();
                  if (q === 'mobile') mappedQuality = '144p';
                  else if (q === 'lowest') mappedQuality = '240p';
                  else if (q === 'low') mappedQuality = '360p';
                  else if (q === 'sd') mappedQuality = '480p';
                  else if (q === 'hd') mappedQuality = '720p';
                  else if (q === 'full') mappedQuality = '1080p';
                  else if (q === 'quad') mappedQuality = '1440p';
                  else if (q === 'ultra') mappedQuality = '2160p';

                  streams.push({
                    server: serverName,
                    name: 'Animexin (OK.ru)',
                    title: `${animeTitle} - Ep ${absoluteEpisode}`,
                    url: s.url,
                    quality: mappedQuality,
                    headers: HEADERS,
                  })
                })
              })
            );
          } else if (sName.includes('daylimotion') || sName.includes('dailymotion') || videoUrl.includes('dailymotion')) {
            extractionPromises.push(
              extractDailymotion(videoUrl).then(dmStreams => {
                dmStreams.forEach(s => {
                  streams.push({
                    server: serverName,
                    name: 'Animexin (DM)',
                    title: `${animeTitle} - Ep ${absoluteEpisode}`,
                    url: s.url,
                    quality: 'auto',
                    headers: HEADERS,
                  })
                })
              })
            );
          }
        }
      } catch (e) {
        console.error('[Animexin] Decryption error:', e.message);
      }
    }
  })

  // Wait for all extractions to complete
  await Promise.all(extractionPromises);

  return streams;
}

async function getStreams(kitsuId, mediaType, season, episode) {
  try {
    const kitsuData = await getKitsuData(kitsuId)
    const attributes = kitsuData?.data?.attributes;
    
    if (!attributes) return [];

    // 1. Compile a list of possible titles (English, Romaji, and Synonyms)
    const searchQueries = new Set();
    
    if (attributes.titles) {
      if (attributes.titles.en) searchQueries.add(attributes.titles.en.split(':')[0].trim());
      if (attributes.titles.en_jp) searchQueries.add(attributes.titles.en_jp.split(':')[0].trim());
    }
    
    if (attributes.abbreviatedTitles && Array.isArray(attributes.abbreviatedTitles)) {
      attributes.abbreviatedTitles.forEach(syn => searchQueries.add(syn.split(':')[0].trim()));
    }

    if (searchQueries.size === 0) return [];

    // Map Season/Episode to Absolute Episode via Kitsu
    const absoluteEpisode = getKitsuAbsoluteEpisode(kitsuId, season, episode);
    let seriesUrl = null;
    let successfulQuery = null;

    // 2. Iterate through potential titles and search Animexin until a match is found
    for (const query of searchQueries) {
      if (!query) continue;
      seriesUrl = await searchAnimexin(query, mediaType);
      if (seriesUrl) {
        successfulQuery = query;
        break;
      }
    }
    
    if (!seriesUrl) return []

    const episodeUrl = await getEpisodeUrl(seriesUrl, absoluteEpisode)
    if (!episodeUrl) return []

    // Fallback to a good display name
    const animeTitle = attributes.titles?.en || attributes.titles?.en_jp || successfulQuery;
    const streams = await extractAllStreams(episodeUrl, animeTitle, absoluteEpisode)
    return streams;
  } catch (error) {
    console.error('[Animexin Provider] Error:', error.message)
    return []
  }
}

module.exports = {
  getStreams,
  fetchText,
  getKitsuData,
  getKitsuAbsoluteEpisode,
  searchAnimexin,
  getEpisodeUrl,
  extractAllStreams
}
