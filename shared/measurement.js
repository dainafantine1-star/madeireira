// Shared by the browser and Node: dimensions are entered in metres.
globalThis.WoodMeasure = Object.freeze({
  calculate(unit, input) {
    if (!['m','m2','m3'].includes(unit)) throw new Error('Este produto não é vendido por metragem.');
    if (!input || typeof input !== 'object') throw new Error('Informe as medidas.');
    const pieces = input.pieces;
    if (!Number.isInteger(pieces) || pieces < 1 || pieces > 10000) throw new Error('Informe de 1 a 10.000 peças inteiras.');
    const keys = unit === 'm' ? ['length'] : unit === 'm2' ? ['length','width'] : ['length','width','thickness'];
    const labels = {length:'comprimento',width:'largura',thickness:'espessura'};
    const dimensions = {pieces};
    let amount = pieces;
    for (const key of keys) {
      const value = input[key];
      if (typeof value !== 'number' || !Number.isFinite(value) || value < 0.001 || value > 1000 || Math.abs(value * 1000 - Math.round(value * 1000)) > 0.000001) throw new Error(`Informe ${labels[key]} em metros, de 0,001 a 1.000, com até três casas decimais.`);
      dimensions[key] = value;
      amount *= value;
    }
    // Bill to the next thousandth, never less than the measured material.
    const qty = Math.ceil(Number(amount.toFixed(9)) * 1000 - 0.00000001) / 1000;
    if (!Number.isFinite(qty) || qty <= 0 || qty > 10000) throw new Error('Metragem fora do limite. Divida a solicitação ou fale com a equipe.');
    const number = n => new Intl.NumberFormat('pt-BR',{maximumFractionDigits:3}).format(n);
    const formula = `${keys.map(k => `${number(dimensions[k])} m`).join(' × ')} × ${pieces} peça(s) = ${number(qty)} ${unit === 'm' ? 'm' : unit === 'm2' ? 'm²' : 'm³'}`;
    return {qty, dimensions, formula};
  }
});
