const GRAMMAR_SEED = [
  // ===== 1. 时态 =====
  {
    category: "时态",
    title: "一般现在时",
    pattern: "主语 + V原/V-s/es + ...",
    explanation: "表示经常性、习惯性的动作或普遍真理。第三人称单数动词需加 -s/-es。在时间/条件状语从句中，用一般现在时代替将来时。",
    examples: [
      { sentence_en: "The earth moves around the sun.", sentence_zh: "地球绕着太阳转。", note: "表示客观真理" },
      { sentence_en: "If it rains tomorrow, I will stay home.", sentence_zh: "如果明天下雨，我就待在家。", note: "条件从句中用一般现在时表将来" }
    ]
  },
  {
    category: "时态",
    title: "现在完成时",
    pattern: "主语 + have/has + 过去分词",
    explanation: "表示过去发生的动作对现在有影响，或从过去一直持续到现在的动作。常与 already, yet, ever, never, since, for 等连用。",
    examples: [
      { sentence_en: "I have already finished my homework.", sentence_zh: "我已经完成了作业。", note: "already 用于肯定句" },
      { sentence_en: "She has lived here since 2018.", sentence_zh: "她从2018年起就住在这里。", note: "since + 时间点" },
      { sentence_en: "Have you ever been to Beijing?", sentence_zh: "你去过北京吗？", note: "ever 用于疑问句表经历" }
    ]
  },
  {
    category: "时态",
    title: "过去完成时",
    pattern: "主语 + had + 过去分词",
    explanation: "表示在过去某一时间或动作之前已经完成的动作，即\"过去的过去\"。常与 before, after, by the time 等连用。",
    examples: [
      { sentence_en: "By the time I arrived, the train had already left.", sentence_zh: "我到达时，火车已经开走了。", note: "by the time + 过去时" },
      { sentence_en: "He had finished his work before the meeting began.", sentence_zh: "会议开始前他已经完成了工作。", note: "before 引出时间参照" }
    ]
  },
  {
    category: "时态",
    title: "将来时表达法",
    pattern: "will do / be going to do / be about to do",
    explanation: "英语中表达将来有多种方式：will 表临时决定或预测；be going to 表计划好的打算或根据迹象判断；be about to 表即将发生；be to do 表按计划/义务。",
    examples: [
      { sentence_en: "I will help you with your bags.", sentence_zh: "我来帮你拿包。", note: "临时决定" },
      { sentence_en: "Look at the clouds — it is going to rain.", sentence_zh: "看那些乌云，要下雨了。", note: "根据迹象判断" },
      { sentence_en: "The meeting is about to start.", sentence_zh: "会议马上就要开始了。", note: "即将发生" }
    ]
  },

  // ===== 2. 从句 =====
  {
    category: "从句",
    title: "定语从句（关系代词）",
    pattern: "先行词 + who/whom/which/that + 从句",
    explanation: "定语从句修饰名词或代词，关系代词在从句中充当主语、宾语或表语。who指人，which指物，that两者皆可。当关系代词在从句中作宾语时可以省略。",
    examples: [
      { sentence_en: "The man who is standing there is my teacher.", sentence_zh: "站在那里的那个人是我的老师。", note: "who 在从句中作主语" },
      { sentence_en: "This is the book (that) I bought yesterday.", sentence_zh: "这就是我昨天买的书。", note: "that 作宾语可省略" },
      { sentence_en: "He lives in a house whose windows face south.", sentence_zh: "他住在一座窗户朝南的房子里。", note: "whose 表所属关系" }
    ]
  },
  {
    category: "从句",
    title: "状语从句",
    pattern: "主句 + 连词(when/if/because/although/so that...) + 从句",
    explanation: "状语从句修饰主句的动词，表示时间、条件、原因、让步、目的、结果等。注意：时间/条件状语从句中要用一般现在时代替将来时。",
    examples: [
      { sentence_en: "He didn't come because he was ill.", sentence_zh: "他没来，因为他生病了。", note: "原因状语从句" },
      { sentence_en: "Although it was raining, they continued working.", sentence_zh: "虽然下着雨，他们还是继续工作。", note: "让步状语从句" },
      { sentence_en: "Speak louder so that everyone can hear you.", sentence_zh: "大声点说，好让大家都听得见。", note: "目的状语从句" }
    ]
  },
  {
    category: "从句",
    title: "名词性从句",
    pattern: "that/wh-词引导的从句作主/宾/表/同位语",
    explanation: "名词性从句在句中充当名词的角色，包括主语从句、宾语从句、表语从句和同位语从句。that 引导陈述，wh-词引导疑问。注意语序必须用陈述句语序。",
    examples: [
      { sentence_en: "What he said surprised everyone.", sentence_zh: "他说的话让所有人都很惊讶。", note: "主语从句" },
      { sentence_en: "I don't know where he lives.", sentence_zh: "我不知道他住在哪里。", note: "宾语从句，陈述语序" },
      { sentence_en: "The fact that he passed the exam made us happy.", sentence_zh: "他通过了考试这件事让我们很开心。", note: "同位语从句" }
    ]
  },

  // ===== 3. 虚拟语气 =====
  {
    category: "虚拟语气",
    title: "if 条件句中的虚拟",
    pattern: "If + 主语 + did/were... , 主语 + would/could/might + do",
    explanation: "表示与事实相反或不太可能实现的假设。与现在事实相反：从句用过去式(were/did)，主句用 would do。与过去事实相反：从句用 had done，主句用 would have done。与将来事实相反：从句用 were to do / should do，主句用 would do。",
    examples: [
      { sentence_en: "If I were you, I would accept the offer.", sentence_zh: "如果我是你，我会接受这个提议。", note: "与现在事实相反" },
      { sentence_en: "If I had studied harder, I would have passed the exam.", sentence_zh: "如果我当时更努力学习，我就通过考试了。", note: "与过去事实相反" },
      { sentence_en: "If it were to snow tomorrow, we would cancel the trip.", sentence_zh: "如果明天真的下雪，我们就取消行程。", note: "与将来事实相反" }
    ]
  },
  {
    category: "虚拟语气",
    title: "wish / if only 虚拟",
    pattern: "wish / if only + 主语 + 过去式/had done/would do",
    explanation: "wish 和 if only 后接虚拟语气表达愿望。现在愿望用过去式，过去愿望用 had done，对将来的愿望用 would/could do。if only 语气比 wish 更强烈。",
    examples: [
      { sentence_en: "I wish I knew the answer.", sentence_zh: "我真希望我知道答案。", note: "现在愿望用过去式" },
      { sentence_en: "I wish I had taken your advice.", sentence_zh: "我真希望我当时听了你的建议。", note: "过去愿望用 had done" },
      { sentence_en: "If only I could speak English fluently.", sentence_zh: "要是我能流利地说英语就好了。", note: "if only 表强烈愿望" }
    ]
  },
  {
    category: "虚拟语气",
    title: "名词性从句中的虚拟（should do）",
    pattern: "suggest/recommend/insist/It is necessary that... + (should) do",
    explanation: "在表示建议、要求、命令、必要等含义的名词性从句中，谓语动词用 \"should + 动词原形\"，should 常可省略。常见动词：suggest, recommend, insist, demand, require, order。常见形容词：necessary, important, essential, strange。",
    examples: [
      { sentence_en: "The teacher suggested that we (should) read more English books.", sentence_zh: "老师建议我们多读英语书。", note: "suggest 宾语从句" },
      { sentence_en: "It is necessary that everyone (should) follow the rules.", sentence_zh: "每个人都必须遵守规则。", note: "It is + adj. + that 主语从句" }
    ]
  },

  // ===== 4. 非谓语动词 =====
  {
    category: "非谓语动词",
    title: "不定式 (to do)",
    pattern: "to + 动词原形",
    explanation: "不定式在句中可作主语、宾语、宾语补足语、定语、状语、表语。表目的、原因或结果。注意：使役动词(let/make/have)和感官动词(see/hear/feel)后接不带 to 的不定式。",
    examples: [
      { sentence_en: "He went to the library to study.", sentence_zh: "他去图书馆学习。", note: "不定式作目的状语" },
      { sentence_en: "She asked me to help her.", sentence_zh: "她请我帮她。", note: "不定式作宾语补足语" },
      { sentence_en: "I heard him sing in the next room.", sentence_zh: "我听见他在隔壁唱歌。", note: "感官动词后接不带 to 的不定式" }
    ]
  },
  {
    category: "非谓语动词",
    title: "动名词 (doing)",
    pattern: "动词-ing 形式作名词使用",
    explanation: "动名词兼具动词和名词的性质，在句中可作主语、宾语、表语、定语。某些动词后只能接动名词作宾语：enjoy, avoid, suggest, mind, finish, practice, consider, admit 等。介词后也接动名词。",
    examples: [
      { sentence_en: "Swimming is good for your health.", sentence_zh: "游泳有益健康。", note: "动名词作主语" },
      { sentence_en: "Would you mind opening the window?", sentence_zh: "你介意开窗吗？", note: "mind + doing" },
      { sentence_en: "He left without saying goodbye.", sentence_zh: "他没说再见就走了。", note: "介词后接动名词" }
    ]
  },
  {
    category: "非谓语动词",
    title: "分词 (doing / done)",
    pattern: "现在分词 doing / 过去分词 done",
    explanation: "分词在句中可作定语、状语、宾语补足语、表语。现在分词表主动和进行，过去分词表被动和完成。分词作状语时，其逻辑主语必须与主句主语一致。",
    examples: [
      { sentence_en: "Hearing the news, she burst into tears.", sentence_zh: "听到消息，她泪流满面。", note: "现在分词作时间状语，表主动" },
      { sentence_en: "Seen from the top of the hill, the city looks beautiful.", sentence_zh: "从山顶看，城市很漂亮。", note: "过去分词作状语，表被动" },
      { sentence_en: "The man talking to Tom is our boss.", sentence_zh: "正在和汤姆说话的那个人是我们老板。", note: "现在分词作后置定语" }
    ]
  },

  // ===== 5. 被动语态 =====
  {
    category: "被动语态",
    title: "基本被动语态",
    pattern: "主语 + be + 过去分词 (+ by + 动作发出者)",
    explanation: "当主语是动作的承受者时使用被动语态。be 动词随时态变化。不知道或不需要指出动作执行者时，by 短语可省略。不及物动词没有被动语态。",
    examples: [
      { sentence_en: "English is spoken all over the world.", sentence_zh: "世界各地都说英语。", note: "一般现在时被动" },
      { sentence_en: "The building was built in 1990.", sentence_zh: "这栋楼建于1990年。", note: "一般过去时被动" },
      { sentence_en: "A new hospital is being built in our city.", sentence_zh: "我们城市正在建一座新医院。", note: "现在进行时被动" }
    ]
  },
  {
    category: "被动语态",
    title: "特殊被动形式",
    pattern: "get + 过去分词 / 情态动词 + be + 过去分词",
    explanation: "口语中常用 get + 过去分词表被动（强调结果而非动作）。带有情态动词的被动：can/must/should + be done。双宾语动词变被动有两种句式。",
    examples: [
      { sentence_en: "He got injured in the accident.", sentence_zh: "他在事故中受了伤。", note: "get + 过去分词 口语被动" },
      { sentence_en: "The work must be finished by Friday.", sentence_zh: "工作必须在周五前完成。", note: "情态动词被动" },
      { sentence_en: "She was given a present. / A present was given to her.", sentence_zh: "有人送了她一个礼物。", note: "双宾语动词两种被动句式" }
    ]
  },

  // ===== 6. 倒装 =====
  {
    category: "倒装",
    title: "部分倒装",
    pattern: "否定词/only + 助动词/情态动词 + 主语 + 动词原形",
    explanation: "当否定意义的词或短语置于句首时，句子需要部分倒装（助动词提到主语前）。常见词有：never, hardly, seldom, not only, no sooner, only + 状语 等。",
    examples: [
      { sentence_en: "Never have I seen such a beautiful sunset.", sentence_zh: "我从未见过如此美丽的日落。", note: "never 置于句首" },
      { sentence_en: "Not only does she speak English, but she also speaks French.", sentence_zh: "她不仅会说英语，还会说法语。", note: "not only 置于句首" },
      { sentence_en: "Only in this way can we solve the problem.", sentence_zh: "只有这样我们才能解决这个问题。", note: "only + 状语置于句首" }
    ]
  },
  {
    category: "倒装",
    title: "完全倒装",
    pattern: "地点/时间状语 + 谓语 + 主语",
    explanation: "当表示地点的介词短语或副词置于句首，且主语为名词（非代词）时，句子需要完全倒装（整个谓语移到主语前）。常用于文学描写中，使场景更生动。",
    examples: [
      { sentence_en: "Here comes the bus.", sentence_zh: "公交车来了。", note: "here 置句首，完全倒装" },
      { sentence_en: "In the middle of the room stood a large table.", sentence_zh: "房间中央放着一张大桌子。", note: "地点状语置句首" }
    ]
  },

  // ===== 7. 主谓一致 =====
  {
    category: "主谓一致",
    title: "就近原则与意义一致",
    pattern: "主语的数决定谓语动词的单复数形式",
    explanation: "就近原则：or, either...or, neither...nor, not only...but also 连接的主语，谓语与最近的主语一致。意义一致：集合名词根据表达整体还是成员决定单复数。数量词作主语时按意义判断。",
    examples: [
      { sentence_en: "Neither he nor I am going to the party.", sentence_zh: "他和我都不去参加聚会。", note: "neither...nor 就近一致" },
      { sentence_en: "The family are having dinner together.", sentence_zh: "一家人正在一起吃晚饭。", note: "family 表成员用复数" },
      { sentence_en: "Ten years is a long time.", sentence_zh: "十年是一段很长的时间。", note: "时间/距离/金钱常视为整体用单数" }
    ]
  },
  {
    category: "主谓一致",
    title: "特殊结构的主谓一致",
    pattern: "there be / 从句作主语 / A as well as B 等",
    explanation: "there be 句型中 be 动词的数与后面第一个主语一致。主语后跟 as well as, together with, along with 等短语时，谓语与原来的主语一致。动名词/不定式/从句作主语用单数。",
    examples: [
      { sentence_en: "There is a book and two pens on the desk.", sentence_zh: "桌上有一本书和两支笔。", note: "there be 就近一致" },
      { sentence_en: "Tom, along with his friends, is going to the concert.", sentence_zh: "汤姆和他的朋友们要去看演唱会。", note: "along with 不影响主语数" },
      { sentence_en: "That he will come is certain.", sentence_zh: "他会来是确定的事。", note: "主语从句用单数" }
    ]
  },

  // ===== 8. 强调句 =====
  {
    category: "强调句",
    title: "It is/was ... that ... 强调结构",
    pattern: "It is/was + 被强调部分 + that/who + 句子其余部分",
    explanation: "这是英语中最常用的强调结构，可以强调主语、宾语、状语等（除谓语外）。当强调人时可用 who 代替 that。判断方法：去掉 It is/was...that 后句子仍然完整。",
    examples: [
      { sentence_en: "It was Tom who (that) broke the window.", sentence_zh: "打破窗户的人是汤姆。", note: "强调主语 Tom" },
      { sentence_en: "It was yesterday that I met him.", sentence_zh: "我是在昨天遇见他的。", note: "强调时间状语 yesterday" },
      { sentence_en: "It is because he is honest that I respect him.", sentence_zh: "正是因为他诚实我才尊敬他。", note: "强调原因状语从句" }
    ]
  },
  {
    category: "强调句",
    title: "用 do/does/did 强调谓语",
    pattern: "主语 + do/does/did + 动词原形",
    explanation: "在肯定句中，在谓语动词前加 do/does/did 表示对动作的强调，译为\"的确/确实\"。do/does 用于一般现在时，did 用于一般过去时。注意：此结构不用于否定句或疑问句的强调。",
    examples: [
      { sentence_en: "I do believe you are right.", sentence_zh: "我确实相信你是对的。", note: "do 强调现在时" },
      { sentence_en: "He did finish the work on time.", sentence_zh: "他确实按时完成了工作。", note: "did 强调过去时" }
    ]
  }
];

module.exports = { GRAMMAR_SEED };
