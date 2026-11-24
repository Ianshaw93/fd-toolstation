import { buildFeeProposalFilename } from '../../lib/fee-proposal-filename';

describe('fee proposal filename', () => {
  it('builds <job number>-Fire Dynamics-Fee-<project name>-Rev00', () => {
    expect(
      buildFeeProposalFilename({
        numberFormatted: '0715',
        projectName: 'DIRFT III DC762',
      }),
    ).toBe('0715-Fire Dynamics-Fee-DIRFT III DC762-Rev00');
  });

  it('keeps leading zeros in numberFormatted and supports custom revision numbers', () => {
    expect(
      buildFeeProposalFilename({
        numberFormatted: '0602',
        projectName: 'Brick House Farm',
        revision: 2,
      }),
    ).toBe('0602-Fire Dynamics-Fee-Brick House Farm-Rev02');
  });

  it('replaces characters that are invalid in Windows filenames and trims whitespace', () => {
    expect(
      buildFeeProposalFilename({
        numberFormatted: ' 06:02 ',
        projectName: ' Brick/House: Farm* "North" <A>? \\side| ',
      }),
    ).toBe('06 02-Fire Dynamics-Fee-Brick House Farm North A side-Rev00');
  });

  it('drops a number or name that is missing or only invalid characters', () => {
    expect(buildFeeProposalFilename({ numberFormatted: null, projectName: 'Brick House Farm' })).toBe(
      'Fire Dynamics-Fee-Brick House Farm-Rev00',
    );
    expect(buildFeeProposalFilename({ numberFormatted: '   ', projectName: 'Brick House Farm' })).toBe(
      'Fire Dynamics-Fee-Brick House Farm-Rev00',
    );
    expect(buildFeeProposalFilename({ numberFormatted: ':::', projectName: 'Brick House Farm' })).toBe(
      'Fire Dynamics-Fee-Brick House Farm-Rev00',
    );

    expect(buildFeeProposalFilename({ numberFormatted: '0602', projectName: null })).toBe(
      '0602-Fire Dynamics-Fee-Rev00',
    );
    expect(buildFeeProposalFilename({ numberFormatted: '0602', projectName: ' \n\t ' })).toBe(
      '0602-Fire Dynamics-Fee-Rev00',
    );
    expect(buildFeeProposalFilename({ numberFormatted: '0602', projectName: '***' })).toBe(
      '0602-Fire Dynamics-Fee-Rev00',
    );

    expect(buildFeeProposalFilename({ numberFormatted: null, projectName: null })).toBe('Fire Dynamics-Fee-Rev00');
  });

  it('keeps characters Windows allows, including ampersands and accents', () => {
    expect(
      buildFeeProposalFilename({
        numberFormatted: '0602',
        projectName: "Café & Co's",
      }),
    ).toBe("0602-Fire Dynamics-Fee-Café & Co's-Rev00");
  });
});
