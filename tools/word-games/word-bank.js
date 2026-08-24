/* Offcuts Word Games — shared word lists.
   Plain global (no bundler): exposes window.WORD_BANK and window.RHYME_BANK. */
(function () {
  const WORD_BANK = {
    littleExplorer: {
      animals: [
        { word: "cat", emoji: "🐱" }, { word: "dog", emoji: "🐶" }, { word: "pig", emoji: "🐷" },
        { word: "cow", emoji: "🐮" }, { word: "hen", emoji: "🐔" }, { word: "fox", emoji: "🦊" },
        { word: "owl", emoji: "🦉" }, { word: "bee", emoji: "🐝" }, { word: "ant", emoji: "🐜" },
        { word: "bat", emoji: "🦇" }, { word: "fish", emoji: "🐟" }, { word: "frog", emoji: "🐸" }
      ],
      food: [
        { word: "egg", emoji: "🥚" }, { word: "pie", emoji: "🥧" }, { word: "ham", emoji: "🍖" },
        { word: "bun", emoji: "🍞" }, { word: "jam", emoji: "🍯" }, { word: "nut", emoji: "🥜" },
        { word: "corn", emoji: "🌽" }, { word: "rice", emoji: "🍚" }, { word: "cake", emoji: "🍰" },
        { word: "milk", emoji: "🥛" }, { word: "taco", emoji: "🌮" }, { word: "soup", emoji: "🍲" }
      ],
      objects: [
        { word: "pen", emoji: "🖊️" }, { word: "cup", emoji: "🥤" }, { word: "hat", emoji: "🎩" },
        { word: "box", emoji: "📦" }, { word: "key", emoji: "🔑" }, { word: "bed", emoji: "🛏️" },
        { word: "sun", emoji: "☀️" }, { word: "kite", emoji: "🪁" }, { word: "ball", emoji: "⚽" },
        { word: "sock", emoji: "🧦" }, { word: "book", emoji: "📖" }, { word: "lamp", emoji: "💡" }
      ]
    },
    wordWhiz: {
      animals: [
        { word: "horse", emoji: "🐴" }, { word: "zebra", emoji: "🦓" }, { word: "tiger", emoji: "🐯" },
        { word: "camel", emoji: "🐫" }, { word: "snake", emoji: "🐍" }, { word: "whale", emoji: "🐳" },
        { word: "otter", emoji: "🦦" }, { word: "rabbit", emoji: "🐰" }, { word: "monkey", emoji: "🐒" },
        { word: "turtle", emoji: "🐢" }, { word: "spider", emoji: "🕷️" }, { word: "gecko", emoji: "🦎" }
      ],
      food: [
        { word: "banana", emoji: "🍌" }, { word: "orange", emoji: "🍊" }, { word: "cheese", emoji: "🧀" },
        { word: "cookie", emoji: "🍪" }, { word: "potato", emoji: "🥔" }, { word: "tomato", emoji: "🍅" },
        { word: "carrot", emoji: "🥕" }, { word: "cherry", emoji: "🍒" }, { word: "muffin", emoji: "🧁" },
        { word: "waffle", emoji: "🧇" }, { word: "pepper", emoji: "🫑" }, { word: "garlic", emoji: "🧄" }
      ],
      objects: [
        { word: "pencil", emoji: "✏️" }, { word: "guitar", emoji: "🎸" }, { word: "wallet", emoji: "👛" },
        { word: "basket", emoji: "🧺" }, { word: "candle", emoji: "🕯️" }, { word: "bucket", emoji: "🪣" },
        { word: "camera", emoji: "📷" }, { word: "ladder", emoji: "🪜" }, { word: "rocket", emoji: "🚀" },
        { word: "hammer", emoji: "🔨" }, { word: "helmet", emoji: "⛑️" }, { word: "jacket", emoji: "🧥" }
      ]
    },
    wordMaster: {
      animals: [
        { word: "elephant", emoji: "🐘" }, { word: "kangaroo", emoji: "🦘" }, { word: "dolphin", emoji: "🐬" },
        { word: "giraffe", emoji: "🦒" }, { word: "squirrel", emoji: "🐿️" }, { word: "penguin", emoji: "🐧" },
        { word: "hedgehog", emoji: "🦔" }, { word: "buffalo", emoji: "🐃" }, { word: "flamingo", emoji: "🦩" },
        { word: "crocodile", emoji: "🐊" }, { word: "butterfly", emoji: "🦋" }, { word: "chameleon", emoji: "🦎" }
      ],
      food: [
        { word: "pineapple", emoji: "🍍" }, { word: "broccoli", emoji: "🥦" }, { word: "sandwich", emoji: "🥪" },
        { word: "spaghetti", emoji: "🍝" }, { word: "avocado", emoji: "🥑" }, { word: "blueberry", emoji: "🫐" },
        { word: "chocolate", emoji: "🍫" }, { word: "croissant", emoji: "🥐" }, { word: "pancakes", emoji: "🥞" },
        { word: "hamburger", emoji: "🍔" }, { word: "pumpkin", emoji: "🎃" }, { word: "cucumber", emoji: "🥒" }
      ],
      objects: [
        { word: "umbrella", emoji: "☂️" }, { word: "telephone", emoji: "☎️" }, { word: "keyboard", emoji: "⌨️" },
        { word: "backpack", emoji: "🎒" }, { word: "notebook", emoji: "📓" }, { word: "calendar", emoji: "📅" },
        { word: "suitcase", emoji: "🧳" }, { word: "elevator", emoji: "🛗" }, { word: "envelope", emoji: "✉️" },
        { word: "telescope", emoji: "🔭" }, { word: "necklace", emoji: "📿" }, { word: "skateboard", emoji: "🛹" }
      ]
    }
  };

  const RHYME_BANK = {
    littleExplorer: [
      { word: "cat", options: ["hat", "dog", "sun"], answer: "hat" },
      { word: "dog", options: ["log", "cat", "hen"], answer: "log" },
      { word: "sun", options: ["fun", "cup", "hat"], answer: "fun" },
      { word: "pig", options: ["wig", "cow", "hen"], answer: "wig" },
      { word: "bee", options: ["tree", "cat", "sun"], answer: "tree" },
      { word: "box", options: ["fox", "cup", "hat"], answer: "fox" },
      { word: "hen", options: ["ten", "dog", "cup"], answer: "ten" },
      { word: "cake", options: ["lake", "fish", "bed"], answer: "lake" },
      { word: "star", options: ["car", "sun", "bee"], answer: "car" },
      { word: "moon", options: ["spoon", "frog", "cat"], answer: "spoon" }
    ],
    wordWhiz: [
      { word: "light", options: ["night", "spoon", "chair"], answer: "night" },
      { word: "chair", options: ["bear", "table", "phone"], answer: "bear" },
      { word: "snake", options: ["cake", "truck", "glove"], answer: "cake" },
      { word: "train", options: ["rain", "shoe", "desk"], answer: "rain" },
      { word: "cloud", options: ["loud", "quiet", "tree"], answer: "loud" },
      { word: "house", options: ["mouse", "plant", "glass"], answer: "mouse" },
      { word: "plate", options: ["gate", "brush", "clock"], answer: "gate" },
      { word: "beach", options: ["peach", "stone", "frame"], answer: "peach" },
      { word: "clock", options: ["rock", "spoon", "glove"], answer: "rock" },
      { word: "green", options: ["queen", "bread", "chalk"], answer: "queen" }
    ],
    wordMaster: [
      { word: "thunder", options: ["wonder", "whisper", "concrete"], answer: "wonder" },
      { word: "mountain", options: ["fountain", "curtain", "engine"], answer: "fountain" },
      { word: "silence", options: ["violence", "distance", "pattern"], answer: "violence" },
      { word: "stranger", options: ["danger", "cabinet", "picture"], answer: "danger" },
      { word: "October", options: ["sober", "object", "hunger"], answer: "sober" },
      { word: "treasure", options: ["pleasure", "texture", "mixture"], answer: "pleasure" },
      { word: "complete", options: ["compete", "concrete", "corrupt"], answer: "compete" },
      { word: "decision", options: ["precision", "division", "fashion"], answer: "precision" },
      { word: "disaster", options: ["master", "pattern", "picture"], answer: "master" },
      { word: "celebrate", options: ["gate", "sorry", "problem"], answer: "gate" }
    ]
  };

  const THEMES = ["animals", "food", "objects"];
  const THEME_LABELS = { animals: "Animals", food: "Food", objects: "Everyday objects" };

  function getWordList(band, theme) {
    const bandBank = WORD_BANK[band] || WORD_BANK.wordWhiz;
    return bandBank[theme] || bandBank.animals;
  }

  function getAllWords(band) {
    const bandBank = WORD_BANK[band] || WORD_BANK.wordWhiz;
    return THEMES.reduce((all, t) => all.concat(bandBank[t] || []), []);
  }

  function getRhymeSet(band) {
    return RHYME_BANK[band] || RHYME_BANK.wordWhiz;
  }

  window.WORD_BANK = WORD_BANK;
  window.RHYME_BANK = RHYME_BANK;
  window.WORD_THEMES = THEMES;
  window.WORD_THEME_LABELS = THEME_LABELS;
  window.getWordList = getWordList;
  window.getAllWords = getAllWords;
  window.getRhymeSet = getRhymeSet;
})();
