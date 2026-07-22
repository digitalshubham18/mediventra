const { calcSalary } = require('../../src/controllers/salaryController');

describe('calcSalary', () => {
  test('computes standard allowances as percentages of basic pay', () => {
    const r = calcSalary(30000, 26, 0);
    expect(r.hra).toBe(Math.round(30000 * 0.40));
    expect(r.da).toBe(Math.round(30000 * 0.12));
    expect(r.ta).toBe(Math.round(30000 * 0.05));
    expect(r.medical).toBe(Math.round(30000 * 0.03));
    expect(r.special).toBe(Math.round(30000 * 0.05));
  });

  test('gross pay is the sum of basic + allowances + overtime + bonus', () => {
    const r = calcSalary(30000, 26, 0, 0, 5000);
    const expectedGross = 30000 + r.hra + r.da + r.ta + r.medical + r.special + r.otPay + 5000;
    expect(r.gross).toBe(expectedGross);
  });

  test('no absent days means no absence deduction', () => {
    const r = calcSalary(26000, 26, 0);
    expect(r.absent).toBe(0);
  });

  test('absent days deduct a proportional per-day amount from basic', () => {
    const r = calcSalary(26000, 24, 2);
    expect(r.absent).toBe(Math.round((26000 / 26) * 2));
    expect(r.absent).toBeGreaterThan(0);
  });

  test('net pay is gross minus every deduction, including the late fine', () => {
    const withoutLate = calcSalary(30000, 26, 0, 0, 0, 0, 0, 0);
    const withLate = calcSalary(30000, 26, 0, 0, 0, 0, 0, 3);
    // 3 unwaived late days at ₹50/day = ₹150 extra deduction
    expect(withLate.lateFine).toBe(150);
    expect(withLate.net).toBe(withoutLate.net - 150);
  });

  test('negative/zero lateDays never produces a negative fine', () => {
    const r = calcSalary(30000, 26, 0, 0, 0, 0, 0, 0);
    expect(r.lateFine).toBe(0);
  });

  test('loan recovery and other deductions reduce net pay 1:1', () => {
    const base = calcSalary(30000, 26, 0);
    const withLoan = calcSalary(30000, 26, 0, 0, 0, 2000, 500);
    expect(withLoan.net).toBe(base.net - 2000 - 500);
  });

  test('overtime pay increases with more overtime hours', () => {
    const noOt = calcSalary(30000, 26, 0, 0);
    const withOt = calcSalary(30000, 26, 0, 10);
    expect(withOt.otPay).toBeGreaterThan(noOt.otPay);
    expect(withOt.gross).toBeGreaterThan(noOt.gross);
  });
});
