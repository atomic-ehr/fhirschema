## Notes

1. elements.<elem[x]>
  1.1 types are expeted to have their own FhirSchema, but we are, like, expanding the choose type
2. elements.<elem>.slicing.<slice>.match
   2.1 is like a weird thing here, repeats the information of the slice schema
   2.2 assuming `match` will remain 
       2.2.1 should be an array always, even when single item included
       2.2.2 type is a new concept: pattern | binding | profile | type, this classification is weird because slice.discriminator already defines the possible types of matching, different from these ones, also I am not sure convining type, binding, patters instead of allowing only one of them is not a requirement (need an example).
3. element.<eleme>.slicing.<slice>.schema
   3.1 the nesting structure for FhirSchema & FhirSchemaElement is: 
  `{"elements": {"<elem>": {"elements": {"<elem>": {"elements": ...}}}}}`. That is great, but the pattern breaks on slices, where we have instead: `{"elements": {"<elem>": {"slicing": {"slices": {"<slice>": {"schema": {"elements": ...}}}}}}}`. Proposal: `{"elements": {"<elem>": {"slicing": {"elements": {"<slice>": ...}}}}}` where inside the slice, we have an element's representation, no separate "schema" element. We are adding only an intermediary "slicing" element.
  * current: elements.<elem>.slicing.[slices.<slice>.schema].elements 
  * proposal: elements.<elem>.slicing.[elements.<slice>].elements