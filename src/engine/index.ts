import { UserInputs } from '../domain/types/UserInputs';
import { Contract } from '../domain/types/Contract';
import { StrategyResult } from '../domain/types/Strategy';

import { buildLongCall } from './builders/longCall';
import { buildLongPut } from './builders/longPut';
import { buildShortCall } from './builders/shortCall';
import { buildShortPut } from './builders/shortPut';
import { buildBullCallSpread } from './builders/bullCallSpread';
import { buildBearPutSpread } from './builders/bearPutSpread';
import { buildBullPutSpread } from './builders/bullPutSpread';
import { buildIronCondor } from './builders/ironCondor';
import { buildIronButterfly } from './builders/ironButterfly';
import { buildCoveredCall } from './builders/coveredCall';
import { buildCashSecuredPut } from './builders/cashSecuredPut';
import { buildStraddle } from './builders/straddle';
import { buildStrangle } from './builders/strangle';

export function getStrategies(params: {
  user: UserInputs,
  options: Contract[],
  slider: number,
  sigma: number
}): StrategyResult[] {
  const { user, options, slider, sigma } = params;
  return [
    ...buildLongCall(user, options, slider),
    ...buildLongPut(user, options, slider),
    ...buildShortCall(user, options, slider),
    ...buildShortPut(user, options, slider),
    ...buildBullCallSpread(user, options, slider),
    ...buildBearPutSpread(user, options, slider),
    ...buildBullPutSpread(user, options, slider),
    ...buildIronCondor(user, options, slider, sigma),
    ...buildIronButterfly(user, options, slider, sigma),
    ...buildCoveredCall(user, options, slider),
    ...buildCashSecuredPut(user, options, slider),
    ...buildStraddle(user, options, slider, sigma),
    ...buildStrangle(user, options, slider, sigma),
  ];
} 