/**
 * Classe Actor para o sistema Contrato de Sangue. Estende as funcionalidades
 * básicas de Actor da Foundry VTT para suportar atributos específicos, cálculo
 * automático de derivados, rolagens de perícias e integração com o módulo
 * Simple Calendar. Os atributos principais são Humanidade, Bestialidade e
 * Mortalidade e a soma dos dois primeiros sempre se mantém em 12. O sistema
 * também mantém uma reserva de dados baseada na Bestialidade e aplica
 * penalidades conforme a Mortalidade cresce.
 */
export class ContractoActor extends Actor {
  /**
   * Prepara dados derivados. Este método é chamado automaticamente pelo
   * mecanismo de Foundry sempre que o ator ou seus itens são atualizados. É
   * usado para calcular a reserva de dados, as penalidades de mortalidade e
   * garantir que Humanidade + Bestialidade permaneçam somando 12.
   */
  prepareDerivedData() {
    super.prepareDerivedData();

    const data = this.system;
    data.attributes = data.attributes || {};
    data.skills = data.skills || {};

    // Inicializa atributos se ainda não existirem (permite criação rápida via CLI)
    data.attributes.humanidade = Number(data.attributes.humanidade ?? 6);
    data.attributes.bestialidade = Number(data.attributes.bestialidade ?? 6);
    data.attributes.mortalidade = Number(data.attributes.mortalidade ?? 0);

    // Enforce that Humanidade + Bestialidade = 12
    const total = data.attributes.humanidade + data.attributes.bestialidade;
    if (total !== 12) {
      // Ajusta Bestialidade para manter a soma, sem permitir números negativos
      data.attributes.bestialidade = Math.max(0, 12 - data.attributes.humanidade);
    }

    // Calcula a reserva de dados: Bestialidade + 1 (máximo 13, pois Bestialidade vai de 1 a 11)
    data.reservaDados = data.reservaDados || {};
    data.reservaDados.max = data.attributes.bestialidade + 1;
    // Assegura que a reserva atual nunca excede o máximo
    if (typeof data.reservaDados.current !== 'number' || data.reservaDados.current > data.reservaDados.max) {
      data.reservaDados.current = data.reservaDados.max;
    }

    // Determina penalidade de mortalidade e frequência de caça
    data.mortalidade = data.mortalidade || {};
    let penalty = 0;
    let huntFrequency = 'none';
    const mort = data.attributes.mortalidade;
    if (mort >= 3 && mort <= 5) {
      penalty = 1;
      huntFrequency = 'weekly';
    } else if (mort >= 6 && mort <= 8) {
      penalty = 2;
      huntFrequency = 'twice-weekly';
    } else if (mort >= 9 && mort <= 11) {
      penalty = 3;
      huntFrequency = 'daily';
    } else if (mort >= 12) {
      penalty = 4;
      huntFrequency = 'constant';
    }
    data.mortalidade.penalty = penalty;
    data.mortalidade.hunt = huntFrequency;

    // Agendamento de caça via Simple Calendar quando cruzar um novo limiar
    // Para evitar duplicidade, guardamos o último nível verificado
    const flags = this.flags['contrato-de-sangue'] ?? {};
    if (flags.lastMortalityLevel !== huntFrequency) {
      this.setFlag('contrato-de-sangue', 'lastMortalityLevel', huntFrequency);
      if (huntFrequency !== 'none') this.#scheduleHuntEvent(huntFrequency);
      // Loga o novo nível de mortalidade
      try {
        const history = duplicate(this.getFlag('contrato-de-sangue', 'history') || []);
        history.push({
          timestamp: Date.now(),
          type: 'mortalidade',
          level: huntFrequency,
          mortalidade: mort
        });
        this.setFlag('contrato-de-sangue', 'history', history);
      } catch (err) {
        console.warn('Falha ao registrar histórico de mortalidade:', err);
      }
    }
  }

  /**
   * Agenda um evento no Simple Calendar de acordo com a frequência de caça.
   * Esta função é privada e não está exposta via API. Caso o módulo
   * Simple Calendar esteja instalado e ativo, tenta criar uma nota para
   * lembrar o jogador de caçar nos intervalos apropriados. Se o módulo não
   * estiver presente, simplesmente registra no console para fins de debug.
   *
   * @param {string} frequency Uma das strings: 'weekly', 'twice-weekly', 'daily', 'constant'.
   */
  #scheduleHuntEvent(frequency) {
    const scModule = game.modules.get('foundryvtt-simple-calendar');
    if (!scModule || !scModule.active || !scModule.api) {
      console.warn('Simple Calendar não encontrado ou inativo. Caça não agendada.');
      return;
    }
    const api = scModule.api;
    // Obtém a data atual do calendário. Cada API pode variar; aqui usamos uma função hipotética currentDate().
    const currentDate = api.currentDate ? api.currentDate() : { year: 0, month: 0, day: 0 };
    // Define incrementos com base na frequência
    let deltaDays = 0;
    switch (frequency) {
      case 'weekly': deltaDays = 7; break;
      case 'twice-weekly': deltaDays = 3; break;
      case 'daily': deltaDays = 1; break;
      case 'constant': deltaDays = 0; break;
    }
    // Calcula a próxima data para o lembrete. Se deltaDays = 0, agenda para hoje.
    const nextDate = Object.assign({}, currentDate);
    nextDate.day += deltaDays;
    // Prepara o evento
    const title = game.i18n.localize('CONTRATO.EVENT.MORTALITY');
    const desc = `Sua mortalidade alcançou um nível que exige caça (${frequency}).`; 
    try {
      api.addEvent({ date: nextDate, title, description: desc });
    } catch (err) {
      console.warn('Falha ao criar evento no Simple Calendar:', err);
    }
  }

  /**
   * Executa uma rolagem de perícia. Exibe um diálogo permitindo ao usuário
   * escolher entre gastar um Dado Sagrado (metade do d6) ou um Dado Umbral
   * (valor cheio do d6 e aumento de Bestialidade). A reserva de dados é
   * reduzida em 1. O resultado final é lançado no chat com formatação
   * apropriada e um resumo textual.
   *
   * @param {string} skillKey A chave da perícia a ser rolada (correspondente a CONFIG.Contrato.skills).
   */
  async rollSkill(skillKey) {
    const skillConfig = CONFIG.Contrato.skills[skillKey];
    if (!skillConfig) {
      ui.notifications.warn(`Perícia desconhecida: ${skillKey}`);
      return;
    }
    const skillLabel = skillConfig.label;
    // Verifica se há dados na reserva
    const { current, max } = this.system.reservaDados;
    if (current <= 0) {
      ui.notifications.warn(`Sem dados na reserva para rolar ${skillLabel}.`);
      return;
    }
    // Cria o diálogo de escolha
    return new Promise((resolve) => {
      let situationalMod = 0;
      // Monta a lista de opções de modificador situacional
      const options = CONFIG.Contrato.modifiers.map(m => `<option value="${m.value}">${m.label} (${m.value >= 0 ? '+' : ''}${m.value})</option>`).join('');
      const htmlContent = `
        <p>${game.i18n.localize('CONTRATO.ROLL.DIALOG.MESSAGE')}</p>
        <div class="form-group">
          <label>Modificador:</label>
          <select class="situational-mod">${options}</select>
        </div>`;
      const dialog = new Dialog({
        title: game.i18n.format('CONTRATO.ROLL.DIALOG.TITLE', { skill: skillLabel }),
        content: htmlContent,
        buttons: {
          sagrado: {
            icon: '<i class="fas fa-cross"></i>',
            label: game.i18n.localize('CONTRATO.ROLL.BUTTON.SAGRADO'),
            callback: html => {
              // obtém o modificador selecionado no momento da confirmação
              const modVal = Number(html.find('.situational-mod').val());
              situationalMod = modVal;
              return this.#executeSkillRoll(skillKey, false, situationalMod).then(resolve);
            }
          },
          umbral: {
            icon: '<i class="fas fa-fire"></i>',
            label: game.i18n.localize('CONTRATO.ROLL.BUTTON.UMBRAL'),
            callback: html => {
              const modVal = Number(html.find('.situational-mod').val());
              situationalMod = modVal;
              return this.#executeSkillRoll(skillKey, true, situationalMod).then(resolve);
            }
          }
        },
        default: 'sagrado',
        render: html => {
          // atualiza o valor inicial do modificador
          html.find('.situational-mod').change(ev => { situationalMod = Number(ev.target.value); });
        }
      });
      dialog.render(true);
    });
  }

  /**
   * Função interna responsável por resolver a rolagem após a escolha do jogador.
   * Reduz a reserva de dados e aplica as alterações de Bestialidade/Humanidade
   * se o dado for umbral. Em seguida, realiza a rolagem 1d12 + perícia + d6
   * (modificado) e envia um chat message.
   *
   * @param {string} skillKey A chave da perícia
   * @param {boolean} umbral Verdadeiro se for um Dado Umbral (valor cheio e aumenta Bestialidade)
   */
  async #executeSkillRoll(skillKey, umbral, situationalMod = 0) {
    const skillVal = Number(this.system.skills[skillKey] || 0);
    const human = Number(this.system.attributes.humanidade);
    const bestia = Number(this.system.attributes.bestialidade);
    // Reduz a reserva de dados
    const reserva = this.system.reservaDados;
    reserva.current = Math.max(0, reserva.current - 1);
    // Rola o d6 para o dado gasto
    const d6Roll = new Roll('1d6');
    await d6Roll.evaluate({ async: true });
    let d6Value = d6Roll.total;
    let modifierDesc = '';
    if (!umbral) {
      // Dado Sagrado: metade arredondada pra cima
      d6Value = Math.ceil(d6Value / 2);
      modifierDesc = game.i18n.localize('CONTRATO.ROLL.BUTTON.SAGRADO');
    } else {
      // Dado Umbral: valor cheio e aumenta Bestialidade
      modifierDesc = game.i18n.localize('CONTRATO.ROLL.BUTTON.UMBRAL');
      // Aumenta Bestialidade diminuindo Humanidade para manter soma 12
      const newBestialidade = Math.min(11, bestia + 1);
      const newHumanidade = Math.max(0, 12 - newBestialidade);
      await this.update({ 'system.attributes.bestialidade': newBestialidade, 'system.attributes.humanidade': newHumanidade });
    }
    // Rola o d12 base
    const roll = new Roll('1d12');
    await roll.evaluate({ async: true });
    const total = roll.total + skillVal + d6Value + situationalMod;
    // Mensagem no chat
    const parts = [];
    parts.push(`<strong>${game.i18n.localize('CONTRATO.ROLL.DIALOG.TITLE').replace('{{skill}}', CONFIG.Contrato.skills[skillKey].label)}</strong>`);
    parts.push(`<p>1d12 (${roll.total}) + perícia (${skillVal}) + ${modifierDesc} (${d6Value}) ${situationalMod !== 0 ? (situationalMod > 0 ? '+ ' + situationalMod : '- ' + Math.abs(situationalMod)) : ''}</p>`);
    parts.push(`<p><strong>Total:</strong> ${total}</p>`);
    const chatData = {
      user: game.user.id,
      speaker: ChatMessage.getSpeaker({ actor: this }),
      content: parts.join('')
    };
    ChatMessage.create(chatData);

    // Registra o evento no histórico do ator
    try {
      const history = duplicate(this.getFlag('contrato-de-sangue', 'history') || []);
      history.push({
        timestamp: Date.now(),
        type: 'roll',
        skill: skillKey,
        total: total,
        humanidade: human,
        bestialidade: bestia,
        mort: this.system.attributes.mortalidade
      });
      await this.setFlag('contrato-de-sangue', 'history', history);
    } catch (err) {
      console.warn('Não foi possível registrar histórico:', err);
    }
    return total;
  }
}