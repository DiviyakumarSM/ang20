import { ComponentFixture, TestBed } from '@angular/core/testing';

import { AssemblyDrillerComponent } from './assembly-driller-component';

describe('AssemblyDrillerComponent', () => {
  let component: AssemblyDrillerComponent;
  let fixture: ComponentFixture<AssemblyDrillerComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AssemblyDrillerComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(AssemblyDrillerComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
