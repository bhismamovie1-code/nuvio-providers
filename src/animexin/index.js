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

async function getTMDBData(tmdbId, mediaType) {
  const tmdbUrl = `https://api.themoviedb.org/3/${mediaType === 'tv' ? 'tv' : 'movie'}/${tmdbId}?api_key=1865f43a0549ca50d341dd9ab8b29f49`
  const tmdbRes = await fetch(tmdbUrl)
  return await tmdbRes.json()
}

function getAbsoluteEpisode(tmdbData, mediaType, season, episode) {
  let absoluteEpisode = episode;
  if (mediaType === 'tv' && season > 1 && tmdbData.seasons) {
    let prevEpisodes = 0;
    for (const s of tmdbData.seasons) {
      if (s.season_number > 0 && s.season_number < season) {
        prevEpisodes += s.episode_count;
      }
    }
    absoluteEpisode = prevEpisodes + episode;
  }
  return absoluteEpisode;
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
  const res = await fetch(url.startsWith('//') ? `https:${url}` : url);
  const text = await res.text();
  const match = text.match(/window\.__PLAYER_CONFIG__\s*=\s*(\{.+?\});/);
  if (!match) return [];
  
  try {
    const config = JSON.parse(match[1]);
    const m3u8Url = config.criticalMetadata?.stream?.url;
    if (m3u8Url) {
      return [{ quality: 'Auto', url: m3u8Url }];
    }
  } catch(e) {}
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
                  streams.push({
                    server: serverName,
                    name: 'Animexin',
                    title: `${animeTitle} - Ep ${absoluteEpisode}`,
                    url: s.url,
                    quality: 'Auto',
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
                    name: 'Animexin',
                    title: `${animeTitle} - Ep ${absoluteEpisode}`,
                    url: s.url,
                    quality: 'Auto',
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

async function getStreams(tmdbId, mediaType, season, episode) {
  try {
    const tmdbData = await getTMDBData(tmdbId, mediaType)
    const animeTitle =
      tmdbData.name ||
      tmdbData.title ||
      tmdbData.original_name ||
      tmdbData.original_title
    if (!animeTitle) return []

    const absoluteEpisode = getAbsoluteEpisode(tmdbData, mediaType, season, episode);
    const searchQuery = animeTitle.split(':')[0].trim()

    const seriesUrl = await searchAnimexin(searchQuery, mediaType)
    if (!seriesUrl) return []

    const episodeUrl = await getEpisodeUrl(seriesUrl, absoluteEpisode)
    if (!episodeUrl) return []

    const streams = await extractAllStreams(episodeUrl, animeTitle, absoluteEpisode)
    return streams;
  } catch (error) {
    console.error('[Animexin Provider] Error:', error.message)
    return []
  }
}

module.exports = {
  getStreams,
  // Exported for testing
  fetchText,
  getTMDBData,
  getAbsoluteEpisode,
  searchAnimexin,
  getEpisodeUrl,
  extractAllStreams
}
