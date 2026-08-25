/**
 * animexin - Built from src/animexin/
 * Generated: 2026-08-25T08:36:43.145Z
 */
var __defProp = Object.defineProperty;
var __getOwnPropSymbols = Object.getOwnPropertySymbols;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __propIsEnum = Object.prototype.propertyIsEnumerable;
var __defNormalProp = (obj, key, value) => key in obj ? __defProp(obj, key, { enumerable: true, configurable: true, writable: true, value }) : obj[key] = value;
var __spreadValues = (a, b) => {
  for (var prop in b || (b = {}))
    if (__hasOwnProp.call(b, prop))
      __defNormalProp(a, prop, b[prop]);
  if (__getOwnPropSymbols)
    for (var prop of __getOwnPropSymbols(b)) {
      if (__propIsEnum.call(b, prop))
        __defNormalProp(a, prop, b[prop]);
    }
  return a;
};
var __async = (__this, __arguments, generator) => {
  return new Promise((resolve, reject) => {
    var fulfilled = (value) => {
      try {
        step(generator.next(value));
      } catch (e) {
        reject(e);
      }
    };
    var rejected = (value) => {
      try {
        step(generator.throw(value));
      } catch (e) {
        reject(e);
      }
    };
    var step = (x) => x.done ? resolve(x.value) : Promise.resolve(x.value).then(fulfilled, rejected);
    step((generator = generator.apply(__this, __arguments)).next());
  });
};

// src/animexin/index.js
var cheerio = require("cheerio-without-node-native");
var MAIN_URL = "https://animexin.dev";
var HEADERS = {
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0.0.0 Safari/537.36",
  Referer: `${MAIN_URL}/`
};
function fetchText(_0) {
  return __async(this, arguments, function* (url, options = {}) {
    const finalUrl = url.startsWith("http") ? url : `${MAIN_URL}${url}`;
    try {
      const response = yield fetch(finalUrl, __spreadValues({ headers: HEADERS }, options));
      if (!response.ok)
        return "";
      return yield response.text();
    } catch (e) {
      return "";
    }
  });
}
function getTMDBData(tmdbId, mediaType) {
  return __async(this, null, function* () {
    const tmdbUrl = `https://api.themoviedb.org/3/${mediaType === "tv" ? "tv" : "movie"}/${tmdbId}?api_key=1865f43a0549ca50d341dd9ab8b29f49`;
    const tmdbRes = yield fetch(tmdbUrl);
    return yield tmdbRes.json();
  });
}
function getAbsoluteEpisode(tmdbData, mediaType, season, episode) {
  let absoluteEpisode = episode;
  if (mediaType === "tv" && season > 1 && tmdbData.seasons) {
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
function searchAnimexin(searchQuery, mediaType) {
  return __async(this, null, function* () {
    const searchUrl = `/?s=${encodeURIComponent(searchQuery)}`;
    const searchHtml = yield fetchText(searchUrl);
    if (!searchHtml)
      return null;
    const $search = cheerio.load(searchHtml);
    let seriesUrl = null;
    $search(".bsx").each((i, el) => {
      const title = $search(el).find(".tt h2").text().trim() || $search(el).find("a").attr("title");
      const href = $search(el).find("a").attr("href");
      const typeText = $search(el).find(".typez").text().toLowerCase();
      if (mediaType === "tv" && typeText.includes("movie"))
        return;
      if (!seriesUrl)
        seriesUrl = href;
      if (title && title.toLowerCase().includes(searchQuery.toLowerCase())) {
        seriesUrl = href;
        return false;
      }
    });
    return seriesUrl;
  });
}
function getEpisodeUrl(seriesUrl, targetEpisode) {
  return __async(this, null, function* () {
    const seriesHtml = yield fetchText(seriesUrl);
    const $series = cheerio.load(seriesHtml);
    let episodeUrl = null;
    $series(".eplister ul li a").each((i, el) => {
      const epNumText = $series(el).find(".epl-num").text() || $series(el).text();
      const match = epNumText.match(/Episode\s*(\d+)/i) || epNumText.match(/\b(\d+)\b/);
      if (match) {
        const parsedNum = parseInt(match[1], 10);
        if (parsedNum === targetEpisode) {
          episodeUrl = $series(el).attr("href");
        }
      }
    });
    return episodeUrl;
  });
}
function extractOkru(url) {
  return __async(this, null, function* () {
    const res = yield fetch(url.startsWith("//") ? `https:${url}` : url);
    const text = yield res.text();
    const match = text.match(/data-options="([^"]+)"/);
    if (!match)
      return [];
    const jsonStr = match[1].replace(/&quot;/g, '"');
    try {
      const data = JSON.parse(jsonStr);
      const metadataStr = data.flashvars.metadata;
      const metadata = JSON.parse(metadataStr);
      return metadata.videos.map((v) => ({
        quality: v.name,
        url: v.url
      }));
    } catch (e) {
      return [];
    }
  });
}
function extractDailymotion(url) {
  return __async(this, null, function* () {
    var _a, _b;
    const res = yield fetch(url.startsWith("//") ? `https:${url}` : url);
    const text = yield res.text();
    const match = text.match(/window\.__PLAYER_CONFIG__\s*=\s*(\{.+?\});/);
    if (!match)
      return [];
    try {
      const config = JSON.parse(match[1]);
      const m3u8Url = (_b = (_a = config.criticalMetadata) == null ? void 0 : _a.stream) == null ? void 0 : _b.url;
      if (m3u8Url) {
        return [{ quality: "Auto", url: m3u8Url }];
      }
    } catch (e) {
    }
    return [];
  });
}
function extractAllStreams(episodeUrl, animeTitle, absoluteEpisode) {
  return __async(this, null, function* () {
    const episodeHtml = yield fetchText(episodeUrl);
    const $ep = cheerio.load(episodeHtml);
    const streams = [];
    const extractionPromises = [];
    $ep(".mobius select option, #server option, .server option, .mobius .mirror option").each((i, el) => {
      const val = $ep(el).attr("value");
      const serverName = $ep(el).text().trim();
      if (val && serverName && serverName.toLowerCase() !== "select video server" && serverName !== "Choose Server") {
        try {
          const decoded = typeof atob !== "undefined" ? atob(val) : Buffer.from(val, "base64").toString("utf-8");
          let videoUrl = null;
          if (decoded.startsWith("http")) {
            videoUrl = decoded;
          } else {
            const $iframe = cheerio.load(decoded);
            videoUrl = $iframe("iframe").attr("src");
          }
          if (videoUrl) {
            const sName = serverName.toLowerCase();
            if (sName.includes("ok.ru") || videoUrl.includes("ok.ru")) {
              extractionPromises.push(
                extractOkru(videoUrl).then((okruStreams) => {
                  okruStreams.forEach((s) => {
                    streams.push({
                      server: serverName,
                      name: "Animexin",
                      title: `${animeTitle} - Ep ${absoluteEpisode}`,
                      url: s.url,
                      quality: "Auto"
                    });
                  });
                })
              );
            } else if (sName.includes("daylimotion") || sName.includes("dailymotion") || videoUrl.includes("dailymotion")) {
              extractionPromises.push(
                extractDailymotion(videoUrl).then((dmStreams) => {
                  dmStreams.forEach((s) => {
                    streams.push({
                      server: serverName,
                      name: "Animexin",
                      title: `${animeTitle} - Ep ${absoluteEpisode}`,
                      url: s.url,
                      quality: "Auto"
                    });
                  });
                })
              );
            }
          }
        } catch (e) {
          console.error("[Animexin] Decryption error:", e.message);
        }
      }
    });
    yield Promise.all(extractionPromises);
    return streams;
  });
}
function getStreams(tmdbId, mediaType, season, episode) {
  return __async(this, null, function* () {
    try {
      const tmdbData = yield getTMDBData(tmdbId, mediaType);
      const animeTitle = tmdbData.name || tmdbData.title || tmdbData.original_name || tmdbData.original_title;
      if (!animeTitle)
        return [];
      const absoluteEpisode = getAbsoluteEpisode(tmdbData, mediaType, season, episode);
      const searchQuery = animeTitle.split(":")[0].trim();
      const seriesUrl = yield searchAnimexin(searchQuery, mediaType);
      if (!seriesUrl)
        return [];
      const episodeUrl = yield getEpisodeUrl(seriesUrl, absoluteEpisode);
      if (!episodeUrl)
        return [];
      const streams = yield extractAllStreams(episodeUrl, animeTitle, absoluteEpisode);
      return streams;
    } catch (error) {
      console.error("[Animexin Provider] Error:", error.message);
      return [];
    }
  });
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
};
