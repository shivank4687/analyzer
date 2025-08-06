import { TestBed } from '@angular/core/testing';

import { CandleAggregatorService } from './candle-aggregator.service';

describe('CandleAggregatorService', () => {
  let service: CandleAggregatorService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(CandleAggregatorService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
