/* A session-only batch worksheet. Nothing is stored or submitted. */
'use strict';
(() => {
  const form = document.getElementById('batch-calculator');
  const output = document.getElementById('batch-result');
  const fields = ['units', 'price', 'cost', 'hours', 'rate'];
  const money = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' });
  form.addEventListener('submit', event => {
    event.preventDefault();
    if (!form.reportValidity()) return;
    const values = fields.map(id => document.getElementById(id).valueAsNumber);
    if (values.some(value => !Number.isFinite(value) || value < 0) || values[0] <= 0) {
      output.textContent = 'Enter a positive unit count and nonnegative numbers for each cost.';
      return;
    }
    const [units, price, cost, hours, rate] = values;
    const revenue = units * price;
    const labor = hours * rate;
    const remaining = revenue - cost - labor;
    output.textContent = `Revenue if all units sell: ${money.format(revenue)}\nLabor at your target rate: ${money.format(labor)}\nOther batch costs: ${money.format(cost)}\n${remaining < 0 ? 'Shortfall after costs and labor' : 'Remaining after costs and labor'}: ${money.format(Math.abs(remaining))}\nBreak-even price per unit: ${money.format((cost + labor) / units)}`;
  });
  form.addEventListener('input', () => {
    output.textContent = 'Figures changed. Calculate again to update the result.';
  });
})();
