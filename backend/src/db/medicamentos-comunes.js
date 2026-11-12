// Catálogo inicial: 100 medicamentos de uso frecuente en la consulta externa en Colombia
// (enfermedades crónicas, dolor, infecciones, respiratorios, salud mental, piel y ojos).
// Son principios activos genéricos, en las presentaciones más comunes.
// [nombre, presentación, stock mínimo]
export const MEDICAMENTOS_COMUNES = [
  // ---------- Hipertensión y corazón ----------
  ['Losartán', '50 mg tabletas', 100],
  ['Enalapril', '20 mg tabletas', 80],
  ['Amlodipino', '5 mg tabletas', 80],
  ['Hidroclorotiazida', '25 mg tabletas', 80],
  ['Valsartán', '160 mg tabletas', 40],
  ['Metoprolol tartrato', '50 mg tabletas', 60],
  ['Carvedilol', '6,25 mg tabletas', 40],
  ['Atenolol', '50 mg tabletas', 30],
  ['Propranolol', '40 mg tabletas', 30],
  ['Nifedipino', '30 mg tabletas de liberación prolongada', 30],
  ['Furosemida', '40 mg tabletas', 40],
  ['Espironolactona', '25 mg tabletas', 30],
  ['Dinitrato de isosorbida', '10 mg tabletas', 20],
  ['Ácido acetilsalicílico', '100 mg tabletas', 100],
  ['Clopidogrel', '75 mg tabletas', 40],
  ['Warfarina', '5 mg tabletas', 20],

  // ---------- Colesterol ----------
  ['Atorvastatina', '20 mg tabletas', 100],
  ['Rosuvastatina', '20 mg tabletas', 40],
  ['Lovastatina', '20 mg tabletas', 40],
  ['Gemfibrozilo', '600 mg tabletas', 30],

  // ---------- Diabetes y tiroides ----------
  ['Metformina', '850 mg tabletas', 100],
  ['Glibenclamida', '5 mg tabletas', 40],
  ['Sitagliptina + metformina', '50 mg/1000 mg tabletas', 30],
  ['Empagliflozina', '25 mg tabletas', 30],
  ['Insulina glargina', '100 UI/mL pluma de 3 mL', 20],
  ['Insulina NPH', '100 UI/mL vial de 10 mL', 15],
  ['Levotiroxina', '50 mcg tabletas', 60],

  // ---------- Dolor, fiebre e inflamación ----------
  ['Acetaminofén', '500 mg tabletas', 150],
  ['Acetaminofén', '150 mg/5 mL jarabe de 90 mL', 30],
  ['Ibuprofeno', '400 mg tabletas', 100],
  ['Ibuprofeno', '100 mg/5 mL suspensión de 120 mL', 20],
  ['Naproxeno', '250 mg tabletas', 60],
  ['Diclofenaco', '50 mg tabletas', 60],
  ['Dipirona', '500 mg tabletas', 60],
  ['Meloxicam', '15 mg tabletas', 40],
  ['Celecoxib', '200 mg cápsulas', 30],
  ['Tramadol', '50 mg cápsulas', 30],
  ['Alopurinol', '300 mg tabletas', 30],
  ['Colchicina', '0,5 mg tabletas', 20],

  // ---------- Estómago e intestino ----------
  ['Omeprazol', '20 mg cápsulas', 120],
  ['Esomeprazol', '40 mg tabletas', 40],
  ['Hidróxido de aluminio y magnesio', 'suspensión oral de 360 mL', 20],
  ['Metoclopramida', '10 mg tabletas', 40],
  ['Butilbromuro de hioscina', '10 mg tabletas', 40],
  ['Ondansetrón', '8 mg tabletas', 20],
  ['Loperamida', '2 mg tabletas', 30],
  ['Sales de rehidratación oral', 'sobre de polvo para 1 litro', 40],
  ['Bisacodilo', '5 mg tabletas', 20],
  ['Lactulosa', '3,3 g/5 mL jarabe de 120 mL', 15],
  ['Simeticona', '80 mg tabletas masticables', 20],

  // ---------- Infecciones ----------
  ['Amoxicilina', '500 mg cápsulas', 100],
  ['Amoxicilina', '250 mg/5 mL suspensión de 100 mL', 30],
  ['Amoxicilina + ácido clavulánico', '875 mg/125 mg tabletas', 40],
  ['Cefalexina', '500 mg cápsulas', 60],
  ['Azitromicina', '500 mg tabletas', 40],
  ['Claritromicina', '500 mg tabletas', 30],
  ['Ciprofloxacina', '500 mg tabletas', 40],
  ['Trimetoprim + sulfametoxazol', '160 mg/800 mg tabletas', 40],
  ['Nitrofurantoína', '100 mg cápsulas', 40],
  ['Metronidazol', '500 mg tabletas', 40],
  ['Doxiciclina', '100 mg cápsulas', 30],
  ['Clindamicina', '300 mg cápsulas', 30],
  ['Fluconazol', '150 mg cápsulas', 30],
  ['Aciclovir', '800 mg tabletas', 20],
  ['Albendazol', '400 mg tabletas', 40],
  ['Nistatina', '100.000 UI/mL suspensión de 60 mL', 15],

  // ---------- Alergias y respiratorio ----------
  ['Loratadina', '10 mg tabletas', 80],
  ['Cetirizina', '10 mg tabletas', 60],
  ['Clorfeniramina', '4 mg tabletas', 40],
  ['Salbutamol', '100 mcg inhalador de 200 dosis', 30],
  ['Beclometasona', '250 mcg inhalador de 200 dosis', 20],
  ['Bromuro de ipratropio', '20 mcg inhalador de 200 dosis', 15],
  ['Montelukast', '10 mg tabletas', 30],
  ['Prednisona', '5 mg tabletas', 40],
  ['Prednisolona', '15 mg/5 mL solución oral de 60 mL', 15],
  ['Dexametasona', '4 mg/mL ampolla de 1 mL', 20],

  // ---------- Salud mental y sistema nervioso ----------
  ['Sertralina', '50 mg tabletas', 60],
  ['Fluoxetina', '20 mg cápsulas', 60],
  ['Escitalopram', '10 mg tabletas', 40],
  ['Amitriptilina', '25 mg tabletas', 40],
  ['Trazodona', '50 mg tabletas', 30],
  ['Quetiapina', '25 mg tabletas', 30],
  ['Clonazepam', '2 mg tabletas', 20],
  ['Ácido valproico', '250 mg cápsulas', 30],
  ['Carbamazepina', '200 mg tabletas', 30],
  ['Fenitoína', '100 mg cápsulas', 20],
  ['Levetiracetam', '500 mg tabletas', 30],
  ['Pregabalina', '75 mg cápsulas', 30],
  ['Gabapentina', '300 mg cápsulas', 30],

  // ---------- Urología, mujer y vitaminas ----------
  ['Tamsulosina', '0,4 mg cápsulas', 30],
  ['Levonorgestrel + etinilestradiol', '0,15 mg/0,03 mg tabletas (ciclo de 21)', 20],
  ['Medroxiprogesterona', '150 mg/mL ampolla', 15],
  ['Sulfato ferroso', '300 mg tabletas', 60],
  ['Ácido fólico', '1 mg tabletas', 60],
  ['Carbonato de calcio + vitamina D', '600 mg/400 UI tabletas', 40],

  // ---------- Piel y ojos ----------
  ['Clotrimazol', '1 % crema de 40 g', 20],
  ['Betametasona', '0,05 % crema de 40 g', 20],
  ['Hidrocortisona', '1 % crema de 15 g', 15],
  ['Timolol', '0,5 % solución oftálmica de 5 mL', 10],
  ['Hialuronato de sodio', '0,4 % lágrimas artificiales de 10 mL', 20],
];
