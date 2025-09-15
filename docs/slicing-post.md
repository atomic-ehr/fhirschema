# FHIR Slicing

FHIR Slicing is a little bit misterious thing. This post intends to demistify it.

First source of confusion is that there are two and a half different things called "slicing".
1. **Collection Slicing** - this is the most common type of slicing, where a list is split into multiple lists based on a discriminator.
2. **Extension Slicing** - this is a type of slicing, where an extension is split into multiple extensions based on a discriminator.
3. **Choice Slicing** - this is a type of slicing, where a choice element is split into multiple choices based on a discriminator.

## Why Collection Slicing

FHIR model is a very generic and instead of introducing multiple specialized elements
it's often defined one element that can be used in multiple ways. For example, Patient.identifier can be used to represent multiple identifiers like SSN, NPI, Driver's license etc. That's good to be able encode different information units in one element
collection. But when you want to specialize FHIR and put specific constraints 
on a specific types of elements (for example regex for SSN) 
- you need to **slice** the collection. So the slicing is a **specialization** of collection slices - which is similar to defining a new elements.


## Extension Slicing

FHIR follows 20/80 rules - ie it defines 20% of the things and then uses 80% of the things to build the rest. For rest 80% FHIR provides extensions mechanism.

Essentially extensions is a way to introduce new elements. But to keep the FHIR resource schema stable FHIR represents this elements as a collection of extensions with
unique url. Roughly speaking this url plays the role of element name. Describing which extension can be used on resource or element is done by slicing of extension element by url.

## Choice Slicing

Some elements may have multiple types. In FHIR this elements represented as choice elements (or polymorphic elements). 
There is **specific** constraint in FHIR - that choice element could not be a collection - it always has max cardinality of 1. 
If you want to narrow types of choice element you need to slice it by type. Which is completely different from slicing of collection.