import { ComponentFixture, TestBed } from '@angular/core/testing';

import { FinalSetup } from './final-setup';

describe('FinalSetup', () => {
  let component: FinalSetup;
  let fixture: ComponentFixture<FinalSetup>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [FinalSetup]
    })
    .compileComponents();

    fixture = TestBed.createComponent(FinalSetup);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
