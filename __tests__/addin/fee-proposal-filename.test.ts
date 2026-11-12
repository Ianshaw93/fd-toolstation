import { buildFeeProposalFilename } from '../../lib/fee-proposal-filename';

const LONDON_NOON = new Date('2026-11-12T12:00:00.000Z');

describe('fee proposal filename', () => {
  it('builds job number, Synergy project name, the fixed phrase, and a London DD-MM-YY date', () => {
    expect(
      buildFeeProposalFilename({
        numberFormatted: '0602',
        projectName: 'Brick House Farm',
        now: LONDON_NOON,
      }),
    ).toBe('0602 Brick House Farm Fire Dynamics Group Fee Proposal 12-11-26');
  });

  it('keeps leading zeros in numberFormatted and does not use the editable form name', () => {
    expect(
      buildFeeProposalFilename({
        numberFormatted: '0602',
        projectName: 'Brick House Farm',
        now: LONDON_NOON,
      }),
    ).toMatch(/^0602 Brick House Farm /);
  });

  it('formats the date in Europe/London, including when that calendar day differs from UTC', () => {
    // 23:30 UTC is 00:30 the next morning in London during British Summer Time.
    expect(
      buildFeeProposalFilename({
        numberFormatted: '0602',
        projectName: 'Brick House Farm',
        now: new Date('2026-07-15T23:30:00.000Z'),
      }),
    ).toBe('0602 Brick House Farm Fire Dynamics Group Fee Proposal 16-07-26');

    // Winter: London is GMT, so this instant is still 12 November there, and the year is two digits.
    expect(
      buildFeeProposalFilename({
        numberFormatted: '1',
        projectName: 'Yard',
        now: new Date('2026-11-12T00:30:00.000Z'),
      }),
    ).toBe('1 Yard Fire Dynamics Group Fee Proposal 12-11-26');

    // 31 December 23:30 UTC is still 31 December in London, not 1 January.
    expect(
      buildFeeProposalFilename({
        numberFormatted: '9',
        projectName: 'Yard',
        now: new Date('2025-12-31T23:30:00.000Z'),
      }),
    ).toBe('9 Yard Fire Dynamics Group Fee Proposal 31-12-25');

    expect(
      buildFeeProposalFilename({
        numberFormatted: '9',
        projectName: 'Yard',
        now: new Date('2026-03-05T12:00:00.000Z'),
      }),
    ).toBe('9 Yard Fire Dynamics Group Fee Proposal 05-03-26');
  });

  it('replaces characters that are invalid in Windows filenames and trims whitespace', () => {
    expect(
      buildFeeProposalFilename({
        numberFormatted: ' 06:02 ',
        projectName: ' Brick/House: Farm* "North" <A>? \\side| ',
        now: LONDON_NOON,
      }),
    ).toBe('06 02 Brick House Farm North A side Fire Dynamics Group Fee Proposal 12-11-26');
  });

  it('drops a number or name that is missing or only invalid characters', () => {
    expect(
      buildFeeProposalFilename({ numberFormatted: null, projectName: 'Brick House Farm', now: LONDON_NOON }),
    ).toBe('Brick House Farm Fire Dynamics Group Fee Proposal 12-11-26');
    expect(
      buildFeeProposalFilename({ numberFormatted: '   ', projectName: 'Brick House Farm', now: LONDON_NOON }),
    ).toBe('Brick House Farm Fire Dynamics Group Fee Proposal 12-11-26');
    expect(
      buildFeeProposalFilename({ numberFormatted: ':::', projectName: 'Brick House Farm', now: LONDON_NOON }),
    ).toBe('Brick House Farm Fire Dynamics Group Fee Proposal 12-11-26');

    expect(
      buildFeeProposalFilename({ numberFormatted: '0602', projectName: null, now: LONDON_NOON }),
    ).toBe('0602 Fire Dynamics Group Fee Proposal 12-11-26');
    expect(
      buildFeeProposalFilename({ numberFormatted: '0602', projectName: ' \n\t ', now: LONDON_NOON }),
    ).toBe('0602 Fire Dynamics Group Fee Proposal 12-11-26');
    expect(
      buildFeeProposalFilename({ numberFormatted: '0602', projectName: '***', now: LONDON_NOON }),
    ).toBe('0602 Fire Dynamics Group Fee Proposal 12-11-26');

    expect(buildFeeProposalFilename({ numberFormatted: null, projectName: null, now: LONDON_NOON })).toBe(
      'Fire Dynamics Group Fee Proposal 12-11-26',
    );
  });

  it('keeps characters Windows allows, including ampersands and accents', () => {
    expect(
      buildFeeProposalFilename({
        numberFormatted: '0602',
        projectName: "Café & Co's",
        now: LONDON_NOON,
      }),
    ).toBe("0602 Café & Co's Fire Dynamics Group Fee Proposal 12-11-26");
  });
});
