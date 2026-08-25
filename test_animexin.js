const {
  getKitsuData,
  getKitsuAbsoluteEpisode,
  searchAnimexin,
  getEpisodeUrl,
  extractAllStreams,
} = require('./src/animexin/index.js')

async function testProvider() {
  console.log('--- Starting Animexin Step-by-Step Test ---\n')

  // Soul Land on Kitsu is 40995 (or just let them know)
  const kitsuId = '48061'
  const mediaType = 'tv'
  const season = 1
  const episode = 67

  try {
    // Step 1: Kitsu Fetch
    console.log('[Step 1] Fetching Kitsu Data...')
    const kitsuData = await getKitsuData(kitsuId)
    const attributes = kitsuData?.data?.attributes

    if (!attributes) {
      console.log('❌ Kitsu returned no data! Provider will fail here.')
      return
    }

    const searchQueries = new Set()
    if (attributes.titles) {
      if (attributes.titles.en)
        searchQueries.add(attributes.titles.en.split(':')[0].trim())
      if (attributes.titles.en_jp)
        searchQueries.add(attributes.titles.en_jp.split(':')[0].trim())
    }

    if (
      attributes.abbreviatedTitles &&
      Array.isArray(attributes.abbreviatedTitles)
    ) {
      attributes.abbreviatedTitles.forEach((syn) =>
        searchQueries.add(syn.split(':')[0].trim()),
      )
    }

    console.log(
      `✅ Found ${searchQueries.size} potential titles/synonyms to search.`,
    )

    // Step 2: Absolute Episode
    console.log('\n[Step 2] Calculating Absolute Episode via Kitsu...')
    const absoluteEpisode = getKitsuAbsoluteEpisode(kitsuId, season, episode)
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
      attributes.titles?.en || attributes.titles?.en_jp || successfulQuery

    // Step 4: Get Episode URL
    console.log('\n[Step 4] Fetching Episode List...')
    console.log(`   Looking for Episode ${absoluteEpisode}...`)
    const episodeUrl = await getEpisodeUrl(seriesUrl, absoluteEpisode)

    if (!episodeUrl) {
      console.log('❌ Episode URL not found on Animexin!')
      return
    }
    console.log(`✅ Episode URL Found: ${episodeUrl}`)

    // Step 5: Extract Streams
    console.log('\n[Step 5] Extracting Stream Video URLs...')
    const streams = await extractAllStreams(
      episodeUrl,
      animeTitle,
      absoluteEpisode,
    )

    if (!streams || streams.length === 0) {
      console.log('❌ No streams extracted from episode page.')
      return
    }
    console.log(`✅ Found ${streams.length} Stream(s)!`)
    streams.forEach((s, idx) => {
      console.log(`   [${idx + 1}] ${s.server} (${s.quality})`)
      console.log(`       URL: ${s.url}`)
    })

    console.log('\n🎉 ALL STEPS PASSED SUCCESSFULLY!')
  } catch (err) {
    console.error('\n❌ TEST FAILED WITH ERROR:', err)
  }
}

testProvider()
