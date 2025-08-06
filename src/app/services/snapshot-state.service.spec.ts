import { TestBed } from '@angular/core/testing';

import { SnapshotStateService } from './snapshot-state.service';

describe('SnapshotStateService', () => {
  let service: SnapshotStateService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(SnapshotStateService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
