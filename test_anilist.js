const query = `
query ($id: Int) {
  Media (id: $id, type: ANIME) {
    title {
      romaji
      english
      native
    }
    episodes
  }
}
`
const variables = {id: 134283} // Try some ID (Soul Land is 101915 I think?)
fetch('https://graphql.anilist.co', {
  method: 'POST',
  headers: {'Content-Type': 'application/json'},
  body: JSON.stringify({query, variables}),
})
  .then((res) => res.json())
  .then((json) => console.log(JSON.stringify(json, null, 2)))
