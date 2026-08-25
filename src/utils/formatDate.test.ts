import { describe, expect, it } from "vitest";
import {
  addDays,
  daysBetween,
  formatDateRange,
  formatDayMonth,
  formatDayMonthTime,
  formatStopDates,
  formatWeekdayDayMonth,
  toDateOnly,
  toTimeOnly,
} from "./formatDate";

describe("toDateOnly / toTimeOnly", () => {
  it("splitst een tijdstempel", () => {
    expect(toDateOnly("2027-01-25T11:45")).toBe("2027-01-25");
    expect(toTimeOnly("2027-01-25T11:45")).toBe("11:45");
  });

  it("levert een lege tijd voor een datum zonder tijd", () => {
    expect(toDateOnly("2027-01-25")).toBe("2027-01-25");
    expect(toTimeOnly("2027-01-25")).toBe("");
  });
});

describe("addDays", () => {
  it("telt dagen op binnen een maand", () => {
    expect(addDays("2027-01-25", 3)).toBe("2027-01-28");
  });

  it("gaat over een maandgrens", () => {
    expect(addDays("2027-01-30", 3)).toBe("2027-02-02");
  });

  it("gaat over een jaargrens", () => {
    expect(addDays("2027-12-30", 3)).toBe("2028-01-02");
  });

  it("kent 2028 als schrikkeljaar", () => {
    expect(addDays("2028-02-28", 1)).toBe("2028-02-29");
    expect(addDays("2028-02-29", 1)).toBe("2028-03-01");
  });

  it("kent 2027 niet als schrikkeljaar", () => {
    expect(addDays("2027-02-28", 1)).toBe("2027-03-01");
  });

  it("verandert niets bij 0 dagen, wat een doortocht is", () => {
    expect(addDays("2027-02-07", 0)).toBe("2027-02-07");
  });

  it("telt terug bij een negatief aantal", () => {
    expect(addDays("2027-03-01", -1)).toBe("2027-02-28");
  });
});

describe("daysBetween", () => {
  it("telt hele dagen", () => {
    expect(daysBetween("2027-01-25", "2027-01-28")).toBe(3);
  });

  it("is 0 voor dezelfde dag", () => {
    expect(daysBetween("2027-01-25", "2027-01-25")).toBe(0);
  });

  it("is negatief als de einddatum eerder ligt", () => {
    expect(daysBetween("2027-01-28", "2027-01-25")).toBe(-3);
  });

  it("negeert het tijddeel", () => {
    expect(daysBetween("2027-01-25T23:59", "2027-01-26T00:01")).toBe(1);
  });

  it("rekent over de zomertijdgrens heen in hele dagen", () => {
    // In Nederland gaat de klok op 28 maart 2027 een uur vooruit. Zonder
    // afronding op hele dagen levert dit 30,958... op en dus 30 in plaats van 31.
    expect(daysBetween("2027-03-01", "2027-04-01")).toBe(31);
  });

  it("rekent over de wintertijdgrens heen in hele dagen", () => {
    expect(daysBetween("2027-10-01", "2027-11-01")).toBe(31);
  });

  it("telt een heel schrikkeljaar", () => {
    expect(daysBetween("2028-01-01", "2029-01-01")).toBe(366);
  });
});

describe("formatDayMonth", () => {
  it("laat de punt achter de maandafkorting weg", () => {
    expect(formatDayMonth("2027-01-25")).toBe("25 jan");
  });

  it("gebruikt geen voorloopnul", () => {
    expect(formatDayMonth("2027-02-07")).toBe("7 feb");
  });
});

describe("formatWeekdayDayMonth", () => {
  it("zet de weekdag ervoor", () => {
    // 25 januari 2027 is een maandag.
    expect(formatWeekdayDayMonth("2027-01-25")).toBe("ma 25 jan");
  });
});

describe("formatDayMonthTime", () => {
  it("houdt de datum erbij, want een nachtvlucht landt de volgende dag", () => {
    expect(formatDayMonthTime("2027-01-26T06:10")).toBe("26 jan 06:10");
  });
});

describe("formatStopDates", () => {
  it("noemt de maand één keer als beide datums er in vallen", () => {
    // 27 januari 2027 is een woensdag, 29 januari een vrijdag.
    expect(formatStopDates("2027-01-27", "2027-01-29")).toBe("wo 27 tot vr 29 jan");
  });

  it("noemt de maand twee keer over een maandgrens", () => {
    // 29 januari 2027 is een vrijdag, 1 februari een maandag.
    expect(formatStopDates("2027-01-29", "2027-02-01")).toBe("vr 29 jan tot ma 1 feb");
  });

  it("noemt één datum voor een doortocht zonder overnachting", () => {
    // 7 februari 2027 is een zondag.
    expect(formatStopDates("2027-02-07", "2027-02-07")).toBe("zo 7 feb");
  });
});

describe("formatDateRange", () => {
  it("schrijft de maanden uit en zet het jaar één keer achteraan", () => {
    expect(formatDateRange("2027-01-25", "2027-02-18")).toBe("25 januari – 18 februari 2027");
  });
});
