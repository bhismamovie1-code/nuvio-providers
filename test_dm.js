async function extractDailymotion(url) {
  const res = await fetch(url)
  console.log(res)

  const text = await res.text()

  const match = text.match(/window\.__PLAYER_CONFIG__\s*=\s*(\{.+?\});/)
  if (!match) return
  const config = JSON.parse(match[1])
  // console.log(config)
  console.log(config.criticalMetadata.stream)
}
extractDailymotion(
  'https://geo.dailymotion.com/player.html?video=k6Xfjm92EhEbfEzeMpB',
)
