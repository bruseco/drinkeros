/** Explicit sales-page routes: unknown courses never receive a guessed details link. */
export const black80CourseDetails: Record<string, {description: string; path?: string}> = {
 'drinkeros-xperience': {description: 'Para quem está começando, faz drinks em casa ou quer dar os primeiros passos como bartender. Aprenda as bases da coquetelaria, técnicas de preparo e receitas.', path: '/drinkeros-xperience'},
 'mixologia-avancada': {description: 'Para bartenders e entusiastas que já conhecem o básico e querem evoluir. Aprofunde suas técnicas e amplie seu repertório de coquetelaria.', path: '/mixologia-avancada'},
 'bar-p-eventos': {description: 'Para quem quer montar ou profissionalizar um serviço de bar para eventos. Aprenda a planejar a operação, calcular custos e organizar o atendimento.', path: '/bar-p-eventos'},
 'bartender-a-bordo': {description: 'Para quem quer trabalhar como bartender em cruzeiros. Conheça a preparação, documentação, processos seletivos e rotina a bordo.', path: '/bartender-a-bordo'},
 'drinkdelivery-engarrafados': {description: 'Para quem quer empreender com drinks por delivery. Aprenda sobre engarrafamento, embalagens, custos, precificação e entrega.', path: '/drinkdelivery-engarrafados'},
 'producao-de-ingredientes-artesanais': {description: 'Para quem faz drinks em casa, bartenders e donos de bar que querem produzir seus ingredientes. Explore xaropes, bitters, infusões, espumas e outras técnicas.', path: '/producao-de-ingredientes-artesanais'},
 'bebida-decifrada': {description: 'Para curiosos e profissionais que querem conhecer melhor os destilados. Descubra histórias, processos de produção, características sensoriais e aplicações em drinks.', path: '/bebida-decifrada'},
 'workshop-alem-dos-classicos': {description: 'Para quem já domina o básico e quer criar além dos clássicos. Explore releituras e técnicas criativas para renovar seu repertório e sua carta de drinks.', path: '/workshop-alem-dos-classicos'},
};
