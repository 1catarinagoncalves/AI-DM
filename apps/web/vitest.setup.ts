// US-261: o wizard grava o rascunho em sessionStorage, que no happy-dom sobrevive entre os
// testes do mesmo arquivo — sem isto o teste seguinte restauraria o rascunho do anterior.
beforeEach(() => sessionStorage.clear())
