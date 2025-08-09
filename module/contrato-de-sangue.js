/**
 * Contrato de Sangue – Foundry VTT System
 *
 * Este módulo implementa um sistema de RPG de horror gótico‑punk inspirado no
 * documento de regras "Contrato de Sangue" fornecido pelo usuário. Ele
 * registra uma ficha de personagem estilizada, calcula valores derivados
 * automaticamente (incluindo a Reserva de Dados, penalidades de Mortalidade
 * e integração com eventos de caça) e inclui um sistema de rolagem para
 * perícias. A ficha utiliza como plano de fundo a imagem enviada pelo
 * usuário, criando uma estética única e imersiva. Traduções em português
 * brasileiro e inglês também são incluídas.
 */

import { ContractoActor } from './contracto-actor.js';
import { ContractoCharacterSheet } from './contracto-character-sheet.js';
import { ContractoItem, ContractoItemSheet } from './contracto-item.js';

// CONFIG and game namespace definitions
Hooks.once('init', async function() {
  console.log('Contrato de Sangue | Inicializando o sistema');

  /**
   * Definições de configuração. Define listas de perícias e outras opções
   * consultadas em diversos locais do sistema. A estrutura é simples para
   * permitir futuras expansões (como vantagens, poderes e equipamentos).
   */
  CONFIG.Contrato = {
    skills: {
      atletismo: { label: game.i18n.localize('CONTRATO.SKILLS.ATLETISMO'), type: 'physical' },
      briga: { label: game.i18n.localize('CONTRATO.SKILLS.BRIGA'), type: 'physical' },
      conducao: { label: game.i18n.localize('CONTRATO.SKILLS.CONDUTCAO'), type: 'physical' },
      furtividade: { label: game.i18n.localize('CONTRATO.SKILLS.FURTIVIDADE'), type: 'physical' },
      sobrevivencia: { label: game.i18n.localize('CONTRATO.SKILLS.SOBREVIVENCIA'), type: 'physical' },
      computadores: { label: game.i18n.localize('CONTRATO.SKILLS.COMPUTADORES'), type: 'mental' },
      investigacao: { label: game.i18n.localize('CONTRATO.SKILLS.INVESTIGACAO'), type: 'mental' },
      medicina: { label: game.i18n.localize('CONTRATO.SKILLS.MEDICINA'), type: 'mental' },
      ocultismo: { label: game.i18n.localize('CONTRATO.SKILLS.OCULTISMO'), type: 'mental' },
      ciencias: { label: game.i18n.localize('CONTRATO.SKILLS.CIENCIAS'), type: 'mental' },
      empatia: { label: game.i18n.localize('CONTRATO.SKILLS.EMPATIA'), type: 'social' },
      expressao: { label: game.i18n.localize('CONTRATO.SKILLS.EXPRESSAO'), type: 'social' },
      intimidacao: { label: game.i18n.localize('CONTRATO.SKILLS.INTIMIDACAO'), type: 'social' },
      persuasao: { label: game.i18n.localize('CONTRATO.SKILLS.PERSUASAO'), type: 'social' },
      subterfugio: { label: game.i18n.localize('CONTRATO.SKILLS.SUBTERFUGIO'), type: 'social' },
      armasBrancas: { label: game.i18n.localize('CONTRATO.SKILLS.ARMAS_BRANCAS'), type: 'combat' },
      armasDeFogo: { label: game.i18n.localize('CONTRATO.SKILLS.ARMAS_DE_FOGO'), type: 'combat' },
      defesa: { label: game.i18n.localize('CONTRATO.SKILLS.DEFESA'), type: 'combat' }
    },
    /**
     * Modificadores situacionais disponíveis para rolagens. Estes são
     * baseados na tabela de regras e podem ser selecionados no diálogo de
     * rolagem para ajustar a dificuldade de acordo com as condições da cena.
     */
    modifiers: [
      { value: 3, label: 'Equipamento perfeito / condições ideais' },
      { value: 1, label: 'Boa preparação / equipamento adequado' },
      { value: 0, label: 'Condições normais' },
      { value: -1, label: 'Condições adversas / equipamento inadequado' },
      { value: -3, label: 'Condições terríveis / sem equipamento' },
      { value: -2, label: 'Pressa extrema' },
      { value: -2, label: 'Ferimentos graves' },
      { value: -1, label: 'Distração significativa' }
    ]
  };

  // Registra classes personalizadas para atores
  CONFIG.Actor.documentClass = ContractoActor;

  // Registra classes personalizadas para itens
  CONFIG.Item.documentClass = ContractoItem;
  // Define tipos de itens suportados (poderes, vantagens, equipamentos)
  CONFIG.Contrato.itemTypes = ['power', 'advantage', 'equipment'];

  // Desregistra a folha padrão e registra a folha estilizada
  Actors.unregisterSheet('core', ActorSheet);
  Actors.registerSheet('contrato-de-sangue', ContractoCharacterSheet, { types: ['character'], makeDefault: true });

  // Registra folha de itens
  Items.unregisterSheet('core', ItemSheet);
  Items.registerSheet('contrato-de-sangue', ContractoItemSheet, { types: CONFIG.Contrato.itemTypes, makeDefault: true });
});

/**
 * Ganchos adicionais depois da inicialização. Este hook expõe utilitários no
 * namespace global `game.contrato` para que macros e módulos externos possam
 * interagir com o sistema de maneira segura. Também é um bom local para
 * carregar outras dependências se necessário.
 */
Hooks.once('ready', () => {
  console.log('Contrato de Sangue | Sistema pronto');
  game.contrato = {
    rollSkill: (actor, skillKey) => actor.rollSkill(skillKey)
  };

  // Registra helper Handlebars para formatar timestamps
  Handlebars.registerHelper('formatTimestamp', function(ts) {
    if (!ts) return '';
    const d = new Date(ts);
    return d.toLocaleString();
  });
});