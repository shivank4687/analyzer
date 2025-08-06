import { TestBed } from '@angular/core/testing';

import { TechnicalIndicatorsService } from './technical-indicators.service';

describe('TechnicalIndicatorsService', () => {
  let service: TechnicalIndicatorsService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(TechnicalIndicatorsService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
