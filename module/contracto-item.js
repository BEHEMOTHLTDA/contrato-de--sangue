/**
 * Item e folha de item para o sistema Contrato de Sangue. São utilizados para
 * representar poderes, vantagens, equipamentos e outros artefatos.
 */
export class ContractoItem extends Item {
  /**
   * Define dados padrão dos itens. Itens de poder e vantagem podem
   * armazenar descrições e efeitos numéricos que serão aplicados pela
   * aplicação manual ou por macros futuras.
   */
  prepareData() {
    super.prepareData();
    const data = this.system;
    data.type = this.type;
    data.name = this.name;
    data.description = data.description || '';
    if (this.type === 'power') {
      data.activation = data.activation || 'ação';
      data.cost = data.cost || 0;
    }
    if (this.type === 'advantage') {
      data.bonus = data.bonus || '';
    }
  }
}

/**
 * Folha de item genérica para todos os tipos de itens do sistema. Apresenta
 * campos de nome, tipo, descrição e propriedades específicas. Customizações
 * futuras podem especializar esta folha para determinados tipos.
 */
export class ContractoItemSheet extends ItemSheet {
  static get defaultOptions() {
    return mergeObject(super.defaultOptions, {
      classes: ['contrato', 'sheet', 'item'],
      template: 'systems/contrato-de-sangue/templates/item-sheet.hbs',
      width: 500,
      height: 400
    });
  }

  getData() {
    const data = super.getData();
    return data;
  }
}