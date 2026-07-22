const { slotToDateTime } = require('../../src/controllers/appointmentController');

describe('slotToDateTime', () => {
  const day = new Date(2026, 6, 19); // July 19, 2026

  test('parses a morning AM slot correctly', () => {
    const d = slotToDateTime(day, '09:00 AM');
    expect(d.getHours()).toBe(9);
    expect(d.getMinutes()).toBe(0);
  });

  test('parses a PM slot correctly, converting to 24-hour time', () => {
    const d = slotToDateTime(day, '02:30 PM');
    expect(d.getHours()).toBe(14);
    expect(d.getMinutes()).toBe(30);
  });

  test('handles 12:00 PM (noon) correctly — stays at hour 12, not 24', () => {
    const d = slotToDateTime(day, '12:00 PM');
    expect(d.getHours()).toBe(12);
  });

  test('handles 12:00 AM (midnight) correctly — becomes hour 0', () => {
    const d = slotToDateTime(day, '12:00 AM');
    expect(d.getHours()).toBe(0);
  });

  test('preserves the given calendar day', () => {
    const d = slotToDateTime(day, '09:00 AM');
    expect(d.getFullYear()).toBe(2026);
    expect(d.getMonth()).toBe(6);
    expect(d.getDate()).toBe(19);
  });

  test('returns null for a malformed time string instead of throwing', () => {
    expect(slotToDateTime(day, 'not a time')).toBeNull();
  });

  test('returns null when no timeSlot is given', () => {
    expect(slotToDateTime(day, undefined)).toBeNull();
    expect(slotToDateTime(day, '')).toBeNull();
  });

  test('is tolerant of extra whitespace around the time', () => {
    const d = slotToDateTime(day, '  09:15 AM  ');
    expect(d.getHours()).toBe(9);
    expect(d.getMinutes()).toBe(15);
  });
});
