import { DEFAULT_REPORT_DETAILS, toReportDetails } from '../../lib/smoke-layer-report';

describe('toReportDetails', () => {
  it('keeps blanks as blanks so the backend can insert engineer prompts', () => {
    const payload = toReportDetails(DEFAULT_REPORT_DETAILS);
    expect(payload.client_name).toBe('');
    expect(payload.intended_purpose).toBe('');
    expect(payload.office_storeys).toBeNull();
    expect(payload.door_width_mm).toBeNull();
    expect(payload.racking_known).toBe(false);
  });

  it('parses the numeric fields and trims text', () => {
    const payload = toReportDetails({
      ...DEFAULT_REPORT_DETAILS,
      client_name: '  Shed Zone Ltd ',
      office_storeys: '2',
      staircases: ' 2 ',
      number_of_doors: '21',
      door_width_mm: '850',
      has_undercroft: true,
    });
    expect(payload.client_name).toBe('Shed Zone Ltd');
    expect(payload.office_storeys).toBe(2);
    expect(payload.staircases).toBe(2);
    expect(payload.number_of_doors).toBe(21);
    expect(payload.door_width_mm).toBe(850);
    expect(payload.has_undercroft).toBe(true);
  });

  it('treats unparseable numbers as not given', () => {
    expect(toReportDetails({ ...DEFAULT_REPORT_DETAILS, office_storeys: 'two' }).office_storeys).toBeNull();
  });
});
