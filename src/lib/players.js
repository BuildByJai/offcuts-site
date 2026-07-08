// Mirrors the player pool hardcoded in tools/fantasy-draft/index.html.
// Kept in sync manually — the frontend has no build step to import shared data from.
export const PLAYER_POOL = [
  // France
  { id: "maignan", name: "Mike Maignan", team: "France", cost: 4 },
  { id: "saliba", name: "William Saliba", team: "France", cost: 6 },
  { id: "upamecano", name: "Dayot Upamecano", team: "France", cost: 6 },
  { id: "tchouameni", name: "Aurélien Tchouaméni", team: "France", cost: 9 },
  { id: "rabiot", name: "Adrien Rabiot", team: "France", cost: 9 },
  { id: "mbappe", name: "Kylian Mbappé", team: "France", cost: 18 },
  { id: "dembele", name: "Ousmane Dembélé", team: "France", cost: 12 },
  { id: "olise", name: "Michael Olise", team: "France", cost: 12 },
  { id: "thuram", name: "Marcus Thuram", team: "France", cost: 12 },
  { id: "doue", name: "Désiré Doué", team: "France", cost: 12 },

  // Morocco
  { id: "bounou", name: "Yassine Bounou", team: "Morocco", cost: 4 },
  { id: "hakimi", name: "Achraf Hakimi", team: "Morocco", cost: 6 },
  { id: "aguerd", name: "Nayef Aguerd", team: "Morocco", cost: 6 },
  { id: "amrabat", name: "Sofyan Amrabat", team: "Morocco", cost: 9 },
  { id: "ounahi", name: "Azzedine Ounahi", team: "Morocco", cost: 9 },
  { id: "elkhannouss", name: "Bilal El Khannouss", team: "Morocco", cost: 9 },
  { id: "elkaabi", name: "Ayoub El Kaabi", team: "Morocco", cost: 12 },
  { id: "brahim", name: "Brahim Díaz", team: "Morocco", cost: 12 },
  { id: "rahimi", name: "Soufiane Rahimi", team: "Morocco", cost: 12 },
  { id: "ezzalzouli", name: "Abde Ezzalzouli", team: "Morocco", cost: 9 },

  // Spain
  { id: "unaisimon", name: "Unai Simón", team: "Spain", cost: 4 },
  { id: "porro", name: "Pedro Porro", team: "Spain", cost: 6 },
  { id: "laporte", name: "Aymeric Laporte", team: "Spain", cost: 6 },
  { id: "rodri", name: "Rodri", team: "Spain", cost: 9 },
  { id: "pedri", name: "Pedri", team: "Spain", cost: 12 },
  { id: "gavi", name: "Gavi", team: "Spain", cost: 12 },
  { id: "merino", name: "Mikel Merino", team: "Spain", cost: 9 },
  { id: "yamal", name: "Lamine Yamal", team: "Spain", cost: 15 },
  { id: "nicowilliams", name: "Nico Williams", team: "Spain", cost: 12 },
  { id: "olmo", name: "Dani Olmo", team: "Spain", cost: 15 },

  // Belgium
  { id: "courtois", name: "Thibaut Courtois", team: "Belgium", cost: 4 },
  { id: "debast", name: "Zeno Debast", team: "Belgium", cost: 6 },
  { id: "kdb", name: "Kevin De Bruyne", team: "Belgium", cost: 15 },
  { id: "tielemans", name: "Youri Tielemans", team: "Belgium", cost: 12 },
  { id: "onana", name: "Amadou Onana", team: "Belgium", cost: 9 },
  { id: "lukaku", name: "Romelu Lukaku", team: "Belgium", cost: 15 },
  { id: "doku", name: "Jérémy Doku", team: "Belgium", cost: 15 },
  { id: "trossard", name: "Leandro Trossard", team: "Belgium", cost: 12 },
  { id: "dektelaere", name: "Charles De Ketelaere", team: "Belgium", cost: 9 },
  { id: "witsel", name: "Axel Witsel", team: "Belgium", cost: 9 },

  // Norway
  { id: "nyland", name: "Ørjan Nyland", team: "Norway", cost: 4 },
  { id: "ajer", name: "Kristoffer Ajer", team: "Norway", cost: 6 },
  { id: "odegaard", name: "Martin Ødegaard", team: "Norway", cost: 15 },
  { id: "berge", name: "Sander Berge", team: "Norway", cost: 9 },
  { id: "haaland", name: "Erling Haaland", team: "Norway", cost: 18 },
  { id: "sorloth", name: "Alexander Sørloth", team: "Norway", cost: 12 },
  { id: "strandlarsen", name: "Jørgen Strand Larsen", team: "Norway", cost: 9 },
  { id: "nusa", name: "Antonio Nusa", team: "Norway", cost: 12 },
  { id: "bobb", name: "Oscar Bobb", team: "Norway", cost: 9 },
  { id: "aasgaard", name: "Thelo Aasgaard", team: "Norway", cost: 9 },

  // England
  { id: "pickford", name: "Jordan Pickford", team: "England", cost: 4 },
  { id: "stones", name: "John Stones", team: "England", cost: 6 },
  { id: "rice", name: "Declan Rice", team: "England", cost: 9 },
  { id: "bellingham", name: "Jude Bellingham", team: "England", cost: 18 },
  { id: "kane", name: "Harry Kane", team: "England", cost: 18 },
  { id: "saka", name: "Bukayo Saka", team: "England", cost: 15 },
  { id: "rashford", name: "Marcus Rashford", team: "England", cost: 15 },
  { id: "watkins", name: "Ollie Watkins", team: "England", cost: 12 },
  { id: "eze", name: "Eberechi Eze", team: "England", cost: 12 },
  { id: "gordon", name: "Anthony Gordon", team: "England", cost: 12 },

  // Argentina
  { id: "dibumartinez", name: "Emiliano Martínez", team: "Argentina", cost: 4 },
  { id: "romero", name: "Cristian Romero", team: "Argentina", cost: 6 },
  { id: "depaul", name: "Rodrigo De Paul", team: "Argentina", cost: 9 },
  { id: "enzo", name: "Enzo Fernández", team: "Argentina", cost: 9 },
  { id: "macallister", name: "Alexis Mac Allister", team: "Argentina", cost: 9 },
  { id: "messi", name: "Lionel Messi", team: "Argentina", cost: 18 },
  { id: "julianalvarez", name: "Julián Álvarez", team: "Argentina", cost: 15 },
  { id: "lautaro", name: "Lautaro Martínez", team: "Argentina", cost: 15 },
  { id: "nicogonzalez", name: "Nicolás González", team: "Argentina", cost: 9 },
  { id: "locelso", name: "Giovani Lo Celso", team: "Argentina", cost: 9 },

  // Switzerland
  { id: "kobel", name: "Gregor Kobel", team: "Switzerland", cost: 4 },
  { id: "akanji", name: "Manuel Akanji", team: "Switzerland", cost: 6 },
  { id: "xhaka", name: "Granit Xhaka", team: "Switzerland", cost: 9 },
  { id: "freuler", name: "Remo Freuler", team: "Switzerland", cost: 9 },
  { id: "embolo", name: "Breel Embolo", team: "Switzerland", cost: 12 },
  { id: "ndoye", name: "Dan Ndoye", team: "Switzerland", cost: 9 },
  { id: "vargas", name: "Rubén Vargas", team: "Switzerland", cost: 9 },
  { id: "amdouni", name: "Zeki Amdouni", team: "Switzerland", cost: 9 },
  { id: "zakaria", name: "Denis Zakaria", team: "Switzerland", cost: 9 },
  { id: "manzambi", name: "Johan Manzambi", team: "Switzerland", cost: 9 },
];

export const MAX_SQUAD = 5;
export const MAX_PER_TEAM = 2;
export const BUDGET_CAP = 65;
