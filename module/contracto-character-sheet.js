import { ContractoActor } from './contracto-actor.js';

/**
 * Folha de personagem personalizada para o sistema Contrato de Sangue. Esta
 * classe altera o template padrão do Foundry para utilizar um layout
 * estilizado inspirado pela imagem fornecida pelo usuário. Os atributos
 * principais (Humanidade, Bestialidade e Mortalidade) e as perícias são
 * exibidas em painéis distintos com botões para rolagem automática. Uma
 * aba adicional permite anotações livres.
 */
export class ContractoCharacterSheet extends ActorSheet {
  static get defaultOptions() {
    return mergeObject(super.defaultOptions, {
      classes: ['contrato', 'sheet', 'actor'],
      template: 'systems/contrato-de-sangue/templates/actor-sheet.hbs',
      width: 800,
      height: 600,
      tabs: [{ navSelector: '.sheet-tabs', contentSelector: '.sheet-body', initial: 'attributes' }],
      scrollY: [
        '.tab-skills',
        '.tab-notes'
      ]
    });
  }

  /**
   * Prepara o contexto de dados enviado ao template. Aqui extraímos as
   * habilidades do CONFIG para organizar por categoria, além de expor os
   * atributos e reserva de dados diretamente no template.
   */
  getData() {
    const data = super.getData();
    const actorData = data.data; // dados do ator (system)
    // Organiza habilidades por tipo e adiciona rótulos traduzidos de categorias
    const categories = {};
    for (const [key, cfg] of Object.entries(CONFIG.Contrato.skills)) {
      const cat = cfg.type;
      if (!categories[cat]) {
        categories[cat] = {
          label: game.i18n.localize(`CONTRATO.SKILLS.TYPE.${cat}`),
          list: []
        };
      }
      categories[cat].list.push({ key, label: cfg.label, value: actorData.skills[key] || 0 });
    }
    // Ordena cada lista de habilidades
    for (const c of Object.values(categories)) {
      c.list.sort((a, b) => a.label.localeCompare(b.label));
    }
    const balance = {
      humanPct: (actorData.attributes.humanidade / 12) * 100,
      bestialPct: (actorData.attributes.bestialidade / 12) * 100
    };
    return {
      ...data,
      system: actorData,
      categories,
      balance
    };
  }

  /**
   * Define ouvintes para eventos da interface. Botões de rolagem de perícias
   * utilizam a função rollSkill do ator. Entrada de atributos atualiza o
   * ator automaticamente ao perder o foco.
   */
  activateListeners(html) {
    super.activateListeners(html);
    if (!this.isEditable) return;
    // Clique para rolar perícias
    html.find('.skill-roll').click(ev => {
      const skill = ev.currentTarget.dataset.skill;
      this.actor.rollSkill(skill);
    });
    // Impede que a soma de Humanidade e Bestialidade fuja de 12 na folha
    html.find('input[data-attr]').change(ev => {
      const input = ev.currentTarget;
      const attr = input.dataset.attr;
      let value = Number(input.value);
      if (Number.isNaN(value)) value = 0;
      const updates = {};
      updates[`system.attributes.${attr}`] = value;
      this.actor.update(updates);
    });
  }
}