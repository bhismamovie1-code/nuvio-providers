const { 
  getTMDBData, 
  getAbsoluteEpisode, 
  searchAnimexin, 
  getEpisodeUrl, 
  extractAllStreams 
} = require('./src/animexin/index.js');

async function testProvider() {
  console.log('--- Starting Animexin Step-by-Step Test ---\n');

  // Test values (Soul Land - TV Show)
  const tmdbId = '76572';
  const mediaType = 'tv';
  const season = 1;
  const episode = 1;

  try {
    // Step 1: TMDB Fetch
    console.log('[Step 1] Fetching TMDB Data...');
    const tmdbData = await getTMDBData(tmdbId, mediaType);
    const animeTitle = tmdbData.name || tmdbData.title || tmdbData.original_name;
    console.log(`✅ Title Found: ${animeTitle}`);
    
    if (!animeTitle) {
      console.log('❌ TMDB returned no title! Provider will fail here.');
      return;
    }

    // Step 2: Absolute Episode
    console.log('\n[Step 2] Calculating Absolute Episode...');
    const absoluteEpisode = getAbsoluteEpisode(tmdbData, mediaType, season, episode);
    console.log(`✅ Calculated Episode Number: ${absoluteEpisode}`);

    // Step 3: Search Animexin
    console.log('\n[Step 3] Searching Animexin...');
    const searchQuery = animeTitle.split(':')[0].trim();
    console.log(`   Searching for: "${searchQuery}"`);
    const seriesUrl = await searchAnimexin(searchQuery, mediaType);
    
    if (!seriesUrl) {
      console.log('❌ No series matched on Animexin! Provider will fail here.');
      return;
    }
    console.log(`✅ Series URL Found: ${seriesUrl}`);

    // Step 4: Get Episode URL
    console.log('\n[Step 4] Fetching Episode List...');
    console.log(`   Looking for Episode ${absoluteEpisode}...`);
    const episodeUrl = await getEpisodeUrl(seriesUrl, absoluteEpisode);
    
    if (!episodeUrl) {
      console.log('❌ Episode not found on the series page! Provider will fail here.');
      return;
    }
    console.log(`✅ Episode URL Found: ${episodeUrl}`);

    // Step 5: Extract All Streams
    console.log('\n[Step 5] Extracting Stream Video URLs...');
    const streams = await extractAllStreams(episodeUrl, animeTitle, absoluteEpisode);
    
    if (!streams || streams.length === 0) {
      console.log('❌ Failed to extract any stream URLs from the episode page!');
      return;
    }
    console.log(`✅ Found ${streams.length} Stream(s)!`);
    streams.forEach((s, idx) => {
      console.log(`   [${idx + 1}] ${s.server}: ${s.url}`);
    });

    console.log('\n🎉 ALL STEPS PASSED SUCCESSFULLY!');
  } catch (err) {
    console.error('\n❌ Unhandled Exception during testing:', err.message);
  }
}

testProvider();
