const {
  getAnilistData,
  getAbsoluteEpisode,
  searchAnimexin,
  getEpisodeUrl,
  extractAllStreams,
} = require('./src/animexin/index.js')

async function testProvider() {
  console.log('--- Starting Animexin Step-by-Step Test ---\n')

  // Test values (Soul Land on Anilist is 101172)
  const anilistId = '166218'
  const mediaType = 'tv'
  const season = 1
  const episode = 1

  try {
    // Step 1: Anilist Fetch
    console.log('[Step 1] Fetching Anilist Data...')
    const anilistData = await getAnilistData(anilistId)
    const media = anilistData?.data?.Media

    if (!media) {
      console.log('❌ Anilist returned no data! Provider will fail here.')
      return
    }

    const searchQueries = new Set()
    if (media.title?.english)
      searchQueries.add(media.title.english.split(':')[0].trim())
    if (media.title?.romaji)
      searchQueries.add(media.title.romaji.split(':')[0].trim())
    if (media.synonyms && Array.isArray(media.synonyms)) {
      media.synonyms.forEach((syn) =>
        searchQueries.add(syn.split(':')[0].trim()),
      )
    }

    console.log(
      `✅ Found ${searchQueries.size} potential titles/synonyms to search.`,
    )

    // Step 2: Absolute Episode
    console.log('\n[Step 2] Calculating Absolute Episode...')
    const absoluteEpisode = episode // Anilist is already absolute!
    console.log(`✅ Calculated Episode Number: ${absoluteEpisode}`)

    // Step 3: Search Animexin
    console.log('\n[Step 3] Searching Animexin...')
    let seriesUrl = null
    let successfulQuery = null

    for (const query of searchQueries) {
      if (!query) continue
      console.log(`   Trying: "${query}" ...`)
      seriesUrl = await searchAnimexin(query, mediaType)
      if (seriesUrl) {
        successfulQuery = query
        console.log(`   ✅ MATCH FOUND!`)
        break
      } else {
        console.log(`   ❌ No match.`)
      }
    }

    if (!seriesUrl) {
      console.log(
        '\n❌ Exhausted all synonyms. No series matched on Animexin! Provider will fail here.',
      )
      return
    }
    console.log(`\n✅ Final Series URL Found: ${seriesUrl}`)

    // Use the successful title for naming the stream
    const animeTitle =
      media.title?.english || media.title?.romaji || successfulQuery

    // Step 4: Get Episode URL
    console.log('\n[Step 4] Fetching Episode List...')
    console.log(`   Looking for Episode ${absoluteEpisode}...`)
    const episodeUrl = await getEpisodeUrl(seriesUrl, absoluteEpisode)

    if (!episodeUrl) {
      console.log(
        '❌ Episode not found on the series page! Provider will fail here.',
      )
      return
    }
    console.log(`✅ Episode URL Found: ${episodeUrl}`)

    // Step 5: Extract All Streams
    console.log('\n[Step 5] Extracting Stream Video URLs...')
    const streams = await extractAllStreams(
      episodeUrl,
      animeTitle,
      absoluteEpisode,
    )

    if (!streams || streams.length === 0) {
      console.log('❌ Failed to extract any stream URLs from the episode page!')
      return
    }
    console.log(`✅ Found ${streams.length} Stream(s)!`)
    streams.forEach((s, idx) => {
      console.log(`   [${idx + 1}] ${s.server} (${s.quality})`)
      console.log(`       URL: ${s.url}`)
    })

    console.log('\n🎉 ALL STEPS PASSED SUCCESSFULLY!')
  } catch (err) {
    console.error('\n❌ Unhandled Exception during testing:', err.message)
  }
}

testProvider()
