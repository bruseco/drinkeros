// Conteúdo enriquecido das páginas de venda de ebooks.
// Adicione aqui detalhes específicos por slug. O fallback usa o
// `description` do banco quando o slug não tiver entrada custom.

export interface EbookSection {
  title: string;
  description: string;
  items: string[];
}

export interface EbookLandingContent {
  tagline: string;
  hero_subtitle: string;
  long_description: string[];
  pages_count?: number;
  what_you_learn: string[];
  sections: EbookSection[];
  who_is_for: string[];
  guarantee_text: string;
  cta_text: string;
}

export const EBOOK_CONTENT: Record<string, EbookLandingContent> = {
  "o-velho-guia-do-bartender": {
    tagline: "O guia clássico que todo aspirante a bartender precisa ter",
    hero_subtitle:
      "28 páginas de puro conhecimento de coquetelaria — utensílios, taças, bebidas e o glossário que você nunca teve coragem de pedir.",
    long_description: [
      "Cansado de não saber a diferença entre uma coqueteleira Boston e uma Cobbler? De confundir mixing glass com jigger? De ouvir nomes em inglês no balcão e ficar perdido?",
      "O Velho Guia do Bartender é o material de referência que reúne, num só PDF lindamente diagramado em estilo dark vintage, tudo o que você precisa saber para começar a falar (e pensar) como um bartender de verdade.",
      "Não é um livro de receitas. É o mapa. É a fundação. É aquele material que fica salvo no seu celular pra consulta rápida quando você esquece o nome do copo certo pra um Hurricane ou quer entender pra que serve cada destilado.",
    ],
    pages_count: 28,
    what_you_learn: [
      "Identificar todos os utensílios essenciais da coquetelaria pelo nome correto",
      "Diferenciar taças e copos e saber qual usar em cada drink",
      "Entender as principais categorias de bebidas (destilados, licores, vermutes, etc.)",
      "Dominar o glossário básico em português e inglês",
      "Ganhar confiança pra conversar sobre coquetelaria sem gaguejar",
    ],
    sections: [
      {
        title: "Utensílios",
        description:
          "Coqueteleira Boston, Cobbler, Parisiense, Mixing Glass, Jigger, Dosador, Macerador, Garrafa Sifão, Strainer Hawthorne, Strainer Julep, Colher Bailarina e muito mais — com pronúncia e ilustração de cada um.",
        items: [
          "Coqueteleira Boston",
          "Coqueteleira Cobbler",
          "Coqueteleira Parisiense",
          "Mixing Glass",
          "Jigger e Dosador",
          "Macerador",
          "Strainer Hawthorne e Julep",
          "Colher Bailarina",
        ],
      },
      {
        title: "Taças & Copos",
        description:
          "Cada drink pede sua taça. Aqui você aprende a identificar Margarita, Hurricane, Old Fashioned, Highball, Coupe, Martini, Flute, Snifter e companhia.",
        items: [
          "Taça Margarita",
          "Copo Hurricane",
          "Old Fashioned",
          "Highball e Collins",
          "Taça Martini e Coupe",
          "Flute pra espumantes",
          "Snifter pra destilados nobres",
        ],
      },
      {
        title: "Bebidas",
        description:
          "O panorama dos destilados, vinhos, cervejas e licores. Entenda a origem, o processo e o uso de cada categoria — base pra montar qualquer drink.",
        items: [
          "Destilados (gin, vodka, rum, tequila, whisky, cachaça)",
          "Vinhos e espumantes",
          "Vermutes e fortificados",
          "Licores e amargos",
          "Cervejas na coquetelaria",
        ],
      },
      {
        title: "Glossário Básico",
        description:
          "Os termos técnicos que aparecem em toda receita de drink: shake, stir, build, muddle, dash, twist, dry, on the rocks, neat, straight up… traduzidos e explicados.",
        items: [
          "Shake, Stir, Build, Muddle",
          "Dash, Splash, Twist, Zest",
          "Neat, Straight up, On the rocks",
          "Dry, Wet, Perfect",
          "Float, Layer, Top",
        ],
      },
    ],
    who_is_for: [
      "Iniciantes que querem entrar no mundo da coquetelaria com o pé direito",
      "Quem já faz drinks em casa mas se perde nos nomes técnicos",
      "Aspirantes a bartender que querem uma base sólida antes dos cursos avançados",
      "Apaixonados por drinks que gostam de ter um material de referência sempre à mão",
    ],
    guarantee_text:
      "7 dias de garantia incondicional. Não curtiu? A gente devolve 100% do seu dinheiro, sem perguntas.",
    cta_text: "Quero meu Velho Guia agora",
  },
};
