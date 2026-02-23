import { ComponentFixture, TestBed } from '@angular/core/testing';

import { Financials } from './financials';

describe('Financials', () => {
  let component: Financials;
  let fixture: ComponentFixture<Financials>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Financials]
    })
    .compileComponents();

    fixture = TestBed.createComponent(Financials);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
