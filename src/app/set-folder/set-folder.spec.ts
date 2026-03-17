import { ComponentFixture, TestBed } from '@angular/core/testing';

import { SetFolder } from './set-folder';

describe('SetFolder', () => {
  let component: SetFolder;
  let fixture: ComponentFixture<SetFolder>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [SetFolder]
    })
    .compileComponents();

    fixture = TestBed.createComponent(SetFolder);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
