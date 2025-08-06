import { TestBed } from '@angular/core/testing';

import { PatternDetectionService } from './pattern-detection.service';

describe('PatternDetectionService', () => {
  let service: PatternDetectionService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(PatternDetectionService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
