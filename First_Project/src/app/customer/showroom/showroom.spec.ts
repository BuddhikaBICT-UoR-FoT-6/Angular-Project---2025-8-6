import { ComponentFixture, TestBed } from '@angular/core/testing';

import { Showroom } from './showroom';

describe('Showroom', () => {
  let component: Showroom;
  let fixture: ComponentFixture<Showroom>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Showroom]
    })
    .compileComponents();

    fixture = TestBed.createComponent(Showroom);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
