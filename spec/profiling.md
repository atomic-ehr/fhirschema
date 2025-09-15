Profiling - FHIR v6.0.0-ballot3                  

[![logo fhir](./assets/images/fhir-logo-www.png)](http://hl7.org/fhir)

**FHIR CI-Build**

[![visit the hl7 website](./assets/images/hl7-logo.png)](http://www.hl7.org)

[![Search CI-Build FHIR](./assets/images/search.png)](http://build.fhir.org/search-build.html)

[FHIR](index.html)

-   [Home](./index.html)
-   [Getting Started](./modules.html)
-   [Documentation](./documentation.html)
-   [Data Types](./datatypes.html)
-   [**_Resource Types_**](./resourcelist.html)
-   [Terminologies](./terminologies-systems.html)
-   [Artifacts](#)
    -   [Extensions](https://build.fhir.org/ig/HL7/fhir-extensions/extension-registry.html)
    -   [Operations](./operationslist.html)
    -   [Patterns](./patterns.html)
    -   [Profiles](./profilelist.html)
    -   [Search Parameters](./searchparameter-registry.html)
    
    -   [Artifact Registry ![icon](external.png)](http://registry.fhir.org) 
-   [Implementation Guides ![icon](external.png)](http://fhir.org/guides/registry) 

-    [![link](conformance.jpg) Conformance](conformance-module.html)
-   **Profiling FHIR**

This is the Continuous Integration Build of FHIR (will be incorrect/inconsistent at times).  
See the [Directory of published versions ![icon](external.png)](http://hl7.org/fhir/directory.html) 

-   [Profiling FHIR](#)
-   [Examples](profiling-examples.html)

## 5.1.0 Profiling FHIR[](profiling.html#5.1.0 "link to here")

[FHIR Infrastructure ![icon](external.png)](http://www.hl7.org/Special/committees/fiwg/index.cfm) Work Group

[Maturity Level](versions.html#maturity): Normative

[Standards Status](versions.html#std-process): [Normative](versions.html#std-process)

The base FHIR specification (this specification) describes a set of base resources, frameworks and APIs that are used in many different contexts in healthcare. However, there is wide variability between jurisdictions and across the healthcare ecosystem around practices, requirements, regulations, education and what actions are feasible and/or beneficial.

For this reason, the FHIR specification is a "platform specification" - it creates a common platform or foundation on which a variety of different solutions are implemented. As a consequence, this specification usually requires further adaptation to particular contexts of use. Typically, these adaptations specify:

-   Rules about which resource elements are or are not used, and what additional elements are added that are not part of the base specification
-   Rules about which API features are used, and how
-   Rules about which terminologies are used in particular elements
-   Descriptions of how the Resource elements and API features map to local requirements and/or implementations

Note that because of the nature of the healthcare ecosystem, there may be multiple overlapping sets of adaptations - by healthcare domain, by country, by institution, and/or by vendor/implementation.

There is a general hierarchy of implementation guidance, each making more agreements with an ever smaller community, where the smaller communities have more in common:

International Base Agreements, e.g. [IPS ![icon](external.png)](http://hl7.org/fhir/uv/ips/) , [IPA ![icon](external.png)](http://hl7.org/fhir/uv/ipa/2022Jan/) , [SDC ![icon](external.png)](http://hl7.org/fhir/uv/sdc/) etc.

National Base Implementation Guides, e.g. [US-Core ![icon](external.png)](http://hl7.org/fhir/us/core) , [AU-Base ![icon](external.png)](http://hl7.org.au/fhir) etc.

Healthcare Clinical Domain, e.g. [mCode ![icon](external.png)](http://hl7.org/fhir/us/mcode/) , [Vital Signs ![icon](external.png)](http://hl7.org/fhir/us/vitals/STU1) 

National Project Agreements e.g. [Dk-Medcom ![icon](external.png)](https://medcomfhir.dk/igcarecommunication/) , [Da Vinci DEQM ![icon](external.png)](http://hl7.org/fhir/us/davinci-deqm/) 

Workflow profiles e.g. [IHE MHD ![icon](external.png)](https://profiles.ihe.net/ITI/MHD/) , [CH Lab Forms ![icon](external.png)](https://fhir.ch/ig/ch-lab-order/index.html) 

Vendor Specific Implementation Guides

Instution Specific Implementation Guides

Note that the implementation guides and profiles that are further down the cascade are generally less likely to be publically available, and more concerned with presence or absence of data and local extensions, while those higher in the cascade are more concerned with meaning, consistent functionality and exchange of data defined in regulation, and are much more likely to be freely publicly available.

HL7 has a [Guidance Implementation Guide ![icon](external.png)](https://build.fhir.org/ig/FHIR/ig-guidance) that provides specific guidance on best practices around IG creation as well as information about some of the tooling extensions and capabilities relevant to creation and publication of implementation guides.

### 5.1.0.1 Glossary[](profiling.html#glossary "link to here")

FHIR defines a cascade of artifacts for this purpose:

**Artifact**

**Description**

**[US Core ![icon](external.png)](http://hl7.org/fhir/us/core) example**

Implementation Guide (IG)

A coherent and bounded set of adaptations that are published as a single unit. Validation occurs within the context of the Implementation Guide

[US Core IG ![icon](external.png)](http://hl7.org/fhir/us/core) 

Package

A group of related adaptations that are published as a group within an Implementation Guide

[US Core Capability Statements ![icon](external.png)](http://hl7.org/fhir/us/core/STU5.0.1/capability-statements.html) 

Conformance Resource

A single resource in a package that makes rules about how an implementation works. These are described below

[US Core Condition Codes Value Set ![icon](external.png)](http://hl7.org/fhir/us/core/STU5.0.1/ValueSet-us-core-condition-code.html) 

Profile

A set of constraints on a resource represented as a structure definition with derivation = `constraint`

[US Core Medication Request ![icon](external.png)](http://hl7.org/fhir/us/core/STU5.0.1/StructureDefinition-us-core-medicationrequest.html) 

The verb 'profile', or 'profiling', is used to describe the process of creating a profile.

### 5.1.0.2 Conformance Resources[](profiling.html#conf-res "link to here")

Typically, Implementation Guides both restrict and extend APIs, resources and terminologies. FHIR provides a set of resources that can be used to represent and share the decisions that have been made, and allows implementers to build useful services from them. These resources are known as the conformance resources. These conformance resources allow implementers to:

-   Indicate that [some API calls](http.html) are not used for a particular situation, and provide additional details about how API calls are used ([Capability Statement](capabilitystatement.html))
-   Add additional [operations](operations.html) or [search parameters](search.html) not in the base specification (using the [OperationDefinition](operationdefinition.html) resource or the [SearchParameter](searchparameter.html) Resource)
-   Define how a particular structure (Resource, Extension or Datatype) is used ([StructureDefinition](structuredefinition.html) Resource):
    -   Describe how existing elements in resources are used
    -   Identify existing elements that are not used
    -   Define extensions that can be used in resources or datatypes
-   Mix custom and standard terminologies and choose which codes from these to use for a particular coded element([Value Set](valueset.html) and StructureDefinition Resources)
-   Map between local and standard terminologies or content models ([Concept Map](conceptmap.html) Resource)
-   Register system namespaces for identifiers and terminologies ([NamingSystem](namingsystem.html) Resource)

These resources need to be used as discussed below, and also following the basic concepts for extension that are described in ["Extensibility"](extensibility.html). For implementer convenience, the specification itself publishes its base definitions using these same resources.

### 5.1.0.3 Two uses of Profiles[](profiling.html#profile-uses "link to here")

The [CapabilityStatement](capabilitystatement.html) resource describes two different uses for profiles on resources: Resource Profiles and Supported Profiles. Resource Profiles are specified using the _CapabilityStatement.rest.resource.profile_ element and Supported Profiles are specified using the _CapabilityStatement.rest.resource.supportedProfile_ element.

#### 5.1.0.3.1 CapabilityStatement.rest.resource.profile[](profiling.html#CapabilityStatement.rest.resource.profile "link to here")

These profiles describe the general features that are supported by the system for each kind of resource. Typically, this is the superset of all the different use-cases implemented by the system. This is a resource-level perspective of a system's functionality.

#### 5.1.0.3.2 CapabilityStatement.rest.resource.supportedProfile[](profiling.html#CapabilityStatement.rest.resource.supportedProfile "link to here")

These profiles describe the information handled/produced by the system on a per use case basis. Some examples of the uses for these kind of profiles:

-   A Laboratory service producing a set of different reports - general chemistry, blood count, etc. Typical labs would support several hundred different reports
-   A care manager which handles a set of different types of care plans and associated clinical resources
-   A medications formulary that handles several different levels of sophistication in its medication representations

These profiles represent different use cases leading to handling resources of the type indicated by the CapabilityStatement.rest.resource.type differently. For instance:

-   A decision support service that provides analysis on several different sets of data conforming to a particular pattern - tests x,y and z with particular codes and units

For a producer system and a consumer system to exchange data successfully based on one of these supported profiles, it is not enough to know that the systems happen to have profiles that overlap for the use case of interest; the consumer must be able to filter the total set of resources made available by the producer system and deal only with the ones relevant to the use case.

As an example, consider a laboratory system generating thousands of reports a day. 1% of those reports are a particular endocrine report that a decision support system knows how to process. Both systems declare that they support the particular endocrine report profile, but how does the decision support system actually find the endocrine reports that it knows how to process?

One possible option is for the decision support system to receive every single report coming from the lab system, check whether it conforms to the profile or not, and then decide whether to process it. Checking whether a resource conforms to a particular profile or not is a straight forward operation (one option is to use the [provided tools for this](downloads.html)), but this is a very inefficient way - the decision support system has to receive and process 100 times as many resources as it uses. To help a consumer find the correct set of reports for a use case, a producer of resources may:

1.  [declare](resource.html#meta) with profile assertions documenting the profile(s) they conform to (this enables indexing by the profile)
2.  search for the declared profiles by the [\_profile](search.html#profile) search parameter, if the search parameter is supported.

To communicate which profiles will be declared, the producer SHOULD use the standard [Declared Profile](https://build.fhir.org/ig/HL7/fhir-extensions/StructureDefinition-capabilitystatement-declared-profile.html) extension on the CapabilityStatement.

> **Note to Implementers:** There are many uninvestigated issues associated with this use of profiles. HL7 is actively seeking feedback from users who experiment in this area, and users should be prepared for changes to features and obligations in this area in the future.
> 
> Feedback is welcome [here ![icon](external.png)](http://hl7.org/fhir-issues) .

### 5.1.0.4 Extending and Restricting the API[](profiling.html#api "link to here")

A CapabilityStatement resource lists the REST interactions (read, update, search, etc.) that a server provides or that a client uses, along with some supporting information for each. It can also be used to define a set of desired behaviors (e.g. as part of a specification or a Request for Proposal). The only interaction that servers are required to support is the [capabilities](http.html#capabilities) interaction itself - to retrieve the server's CapabilityStatement. Beyond that, servers and clients support and use whichever API calls are relevant to their use case.

In addition to the operations that FHIR provides, servers may provide additional operations that are not part of the FHIR specification. Implementers can safely do this by appending a custom operation name prefixed with '$' to an existing FHIR URL, as the [Operations framework](operations.html) does. The Conformance resource supports defining what OperationDefinitions make use of particular names on an end-point. If services are defined that are not declared using OperationDefinition, it may be appropriate to use longer names, reducing the chance of collision (and confusion) with services declared by other interfaces. The base specification will never define operation names with a "." (period) in them, so implementers are recommended to use some appropriate prefix in their names (such as "ihe.someService") to reduce the likelihood of name conflicts.

Implementations are encouraged, but not required, to define operations using the standard FHIR operations framework - that is, to declare the operations using the OperationDefinition resource, but some operations may involve formats that can't be described that way.

Implementations are also able to extend the FHIR API using additional content types. For instance, it might be useful to [read](http.html#read) or [update](http.html#update) the appointment resources using a vCard based format. vCard defines its own mime type, and these additional mime types can safely be used in addition to those defined in this specification.

### 5.1.0.5 Extending and Restricting Resources[](profiling.html#resources "link to here")

Extending and restricting resources (collectively known as 'profiling a resource') is done with a "StructureDefinition" resource, which is a statement of rules about how the elements in a resource are used, and where extensions are used in a resource.

### 5.1.0.6 Changing Cardinality[](profiling.html#cardinality "link to here")

One key function of profiles is to change the cardinality of an element. A profile can restrict the cardinality of an element within the limits of the base structure it is constraining. This table summarizes what types of restrictions are allowed:

derived (across)  
base (down)

0..0  
(Not used)

0..1  
(optional)

0..n  
(optional, many)

1..1  
(required)

1..n  
(at least 1)

0..1

yes

yes

no

yes

no

0..\*

yes

yes

yes

yes

yes

1..1

no

no

no

yes

no

1..\*

no

no

no

yes

yes

When a profile is constraining another profile where there are more cardinality options (e.g. low is not just 0 or 1, and high is not just 1 or \*), the same principles still apply: the constraining profile can only allow what the base profile allows.

Note that though a profile can constrain an element from x..\* to x..1, this doesn't make any difference to the representation in the JSON format - the element will still be represented in an array. As an example, take Patient.name which has a cardinality of 0..\*. In an unprofiled Patient, this will be represented as:

```
{
  "resourceType" : "Patient",
	"name" : [{
	   "text" : "Peter James"
	}]
}

```

Even if a profile is created on the resource that narrows the cardinality to 1..1, applications will still process the resource without knowledge of the profile. For this reason the representation will still be the same.

### 5.1.0.7 Limitations of Use[](profiling.html#limitations "link to here")

What StructureDefinitions can do when they are constraining existing resources and datatypes is limited in some respects:

-   Profiles cannot break the rules established in the base specification (e.g. cardinality as described above)
-   Profiles cannot specify default values or meanings for elements defined in the base specification (note that datatypes and resources do not define default values at all, but default values may be defined for [logical models](structuredefinition.html#logical)
-   Profiles cannot change the name of elements defined in the base specification, or add new elements
-   It must be safe to process a resource without knowing the profile

The consequence of this is that if a profile mandates extended behavior that cannot be ignored, it must also mandate the use of a [modifier extension](extensibility.html#modifiers). Another way of saying this is that knowledge must be explicit in the instance, not implicit in the profile.

As an example, if a profile wished to describe that a [Procedure](procedure.html) resource was being negated (e.g. asserting that it never happened), it could not simply say in the profile itself that this is what the resource means; instead, the profile must say that the resource must have an extension that represents this knowledge.

There is a facility to mark resources to indicate that they can only be safely understood by a process that is aware of and understands a set of published rules. For more information, see [Restricted Understanding of Resources](resource.html#implicitRules).

### 5.1.0.8 Profiling descriptive elements[](profiling.html#descriptive "link to here")

Some properties of an element are purely descriptive and aren't used as part of the validation process. These elements can be refined to reflect constraints applied elsewhere for the element and/or to reflect the context of use of the element within the profile. Changes need to be made cautiously however. The meaning and guidance provided in the base resource or profile can't be invalidated, only constrained or contextualized.

There are two types of changes that can be made to descriptive elements - revising the existing content, or adding or removing elements. Removing an element is only appropriate if the element no longer applies in the context of the constraints/domain space of the profile. The following table indicates which types of changes are allowed for which elements:

Element

Revise?

Add?

Remove?

label

Yes

code.coding

Yes

Yes

short

Yes

definition

Yes

comment

Yes

Yes

Yes

requirements

Yes

Yes

alias

Yes

Yes

Yes

example

Yes

Yes

Yes

mapping

Yes

Yes

Yes

### 5.1.0.9 Using StructureDefinitions[](profiling.html#using "link to here")

A "constraint" StructureDefinition specifies a set of restrictions on the content of a FHIR resource or datatype, or an additional set of constraints on an existing profile. A given structure definition is identified by its canonical URL, which SHOULD be the URL at which it is published. The following kinds of statements can be made about how an element is used, using a series of [Element Definitions](elementdefinition.html):

-   Restricting the cardinality of the element; e.g. the base might allow 0..\*, and a particular application might support 1..2
-   Ruling out use of an element by setting its maximum cardinality to 0
-   Restricting the contents of an element to a single fixed value
-   Making additional constraints on the content of nested elements within the resource (expressed as FHIRPath statements)
-   Restricting the types for an element that allows multiple types
-   Requiring a typed element or the target of a resource reference to conform to another structure profile (declared in the same profile, or elsewhere)
-   Specifying a binding to a different terminology value set (see below)
-   Providing refined definitions, comments/usage notes and examples for the elements defined in a Resource to reflect the usage of the element within the context of the Profile
-   Providing more specific or additional mappings (e.g. to [HL7 V2 ![icon](external.png)](http://www.hl7.org/implement/standards/product_brief.cfm?product_id=185) or [HL7 v3 ![icon](external.png)](https://www.hl7.org/implement/standards/product_brief.cfm?product_id=186) ) for the resource when used in a particular context
-   Declaring that one or more elements in the structure must be 'supported' (see below)
-   Restricting / clarifying a mapping by providing a new mapping with the same identity, which means that the new mapping replaces a mapping with the same identity in the element being profiled

Any changed definitions SHALL be restrictions that are consistent with the rules defined in the resource in the FHIR Specification from which the profile is derived. Note that some of these restrictions can be enforced by tooling (and are by the FHIR tooling), but others (e.g. alignment of changes to descriptive text) cannot be automatically enforced.

Note that structure definitions cannot 'remove' mappings and constraints that are defined in the base structure, but for purposes of clarity, they can refrain from repeating them.

A structure definition contains a linear list of [element definitions](elementdefinition.html). The inherent nested structure of the elements is derived from the _path_ value of each element. For instance, a sequence of the element paths like this:

-   Root
-   Root.childA
-   Root.childA.grandchild1
-   Root.childB

defines the following structure:

```
 <Root>
   <childA>
     <grandChild1/>
   </childA>
   <childB/>
 </Root>

```

or its JSON equivalent. The structure is coherent - children are never implied, and the path statements are always in order. The element list is a linear list rather than being explicitly nested because element definitions are frequently re-used in multiple places within a single definition, and this re-use is easier with a flat structure.

### 5.1.0.10 Recursive Elements[](profiling.html#recurse "link to here")

Some backbone elements recurse. E.g. Questionnaire.item. When a profile defines constraints on such elements, the constraints apply to the recursive references to those elements as well. I.e. If Questionnaire.item is constrained to have a type of 'group', that will cause Questionnaire.item.item, Questionnaire.item.item.item, etc. to all have the same constraint.

If there is a need to enforce constraints on a recursive item that apply at some levels but not others (e.g. only the root, or everything except the root), formal constraints using FHIRPath can be used that limit their behavior to only the root or other specific levels of nesting can be used.

### 5.1.0.11 Differential vs Snapshot[](profiling.html#snapshot "link to here")

StructureDefinitions may contain a differential statement, a snapshot statement or both.

Differential statements describe only the differences that they make relative to the structure definition they constrain (which is most often the base FHIR resource or datatype). For example, a profile may make a single element mandatory (cardinality 1..1). In the example of a differential structure, it will contain a single element with the path of the element being made mandatory, and a cardinality statement. Nothing else is stated - all the rest of the structural information is implied (note that this means that a differential profile can be sparse and only mention the elements that are changed, without having to list the full structure. This rule includes the root element - it is not needed in a sparse differential).

Note that a differential can choose not to constrain elements. Doing so means that the profile will be more flexible in terms of compatibility with other profiles, but will require more work to support from implementing systems. Alternatively, a profile can constrain all optional elements to be not present (max cardinality = 0) - this closes the content, which makes implementation easier, but also reduces its usefulness.

In order to properly understand a differential structure, it must be applied to the structure definition on which it is based. In order to save tools from needing to support this operation (which is computationally intensive - and impossible if the base structure is not available), a StructureDefinition can also carry a "snapshot" - a fully calculated form of the structure that is not dependent on any other structure. The FHIR project provides tools for the common platforms that can populate a snapshot from a differential (note that the tools generate complete verbose snapshots; they do not support suppressing mappings or constraints).

StructureDefinitions can contain both a differential and a snapshot view. In fact, this is the most useful form - the differential form serves the authoring process, while the snapshot serves the implementation tooling. StructureDefinition resources used in operational systems should always have the snapshot view populated.

### 5.1.0.12 Slicing[](profiling.html#slicing "link to here")

One common feature of constraining StructureDefinitions is to take an element that may occur more than once (e.g. in a list), and then split the list into a series of sub-lists, each with different restrictions on the elements in the sub-list with associated additional meaning. In FHIR, this operation is known as "Slicing" a list. It is common to "slice" a list into sub-lists with each containing just one element, effectively putting constraints on each element in the list.

Here is an example to illustrate the process:

![Slicing diagram](slicing.png)

In this example, the base structure definition for the resource [Observation](observation.html) defines the "component" element which contains a nested code and a value for observations that have multiple values. A classic example of this kind of observation is a blood pressure measurement - it contains 2 values, one for systolic, and one for diastolic ([example](observation-example-bloodpressure.html)).

This diagram shows the conceptual process of 'slicing' the component list into systolic and diastolic slices (note that to avoid clutter, the "name" attribute of Observation is shown as just a code not a full CodeableConcept).

The structure definition for Blood Pressure splits the component list into two sub-lists of one element each: a systolic element, and a diastolic element. Each of these elements has a fixed value for the code element (a fixed LOINC code for the name), and both have a value of type Quantity. This process is known as "slicing" and the Systolic and Diastolic elements are called "slices".

Note that when the resource is exchanged, the serialization format that is exchanged is not altered by the constraining definition. This means that the item profile names defined in the structure definition ("systolic", etc. in this example) are never exchanged. A resource instance looks like this:

```
 <Observation>
   ...
   <component>
     <code {LOINC="8480-6"}/>
     <value ...>
   </component>
   <component>
     <code {LOINC="8462-4"}/>
     <value ...>
   </component>
 </Observation>

```

In order to determine that the first related item corresponds to "Systolic" in the structure definition, so that it can then determine to which additional constraints for a sub-list the item conforms, the system checks the values of the elements. In this case, the "code" element in the target resource can be used to determine which slice that target refers to. This element is called the "discriminator".

### 5.1.0.13 Discriminator[](profiling.html#discriminator "link to here")

In the general case, systems processing resources using a structure definition that slices a list can determine the slice corresponding to an item in the list by checking whether the item's content meets the rules specified for the slice. This would require a processor to be able to check all the rules applied in the slice and to do so speculatively in a depth-first fashion. Both of these requirements are inappropriately difficult for an operational system, and particularly for generated code (e.g. software that is automatically produced based on the StructureDefinition). Thus, to provide a better way to distinguish slices, a sliced element can designate a field or set of fields that act as a "discriminator" used to tell the slices apart.

When a discriminator is provided, the composite of the values of the elements designated in the discriminator is unique and distinct for each possible slice and applications can easily determine which slice an item in a list is. The intention is that this can be done in generated code, e.g. using a switch/case statement.

When a constraining structure designates one or more discriminators, it SHALL ensure that the possible values for each slice are different and non-overlapping, so that the slices can easily be distinguished.

Each discriminator is a pair of values: a type that indicates how the field is processed when evaluating the discriminator, and a [FHIRPath](fhirpath.html) expression that identifies the element in which the discriminator is found. There are five different processing types for discriminators:

[value](#value)

The slices have different values in the nominated element, as determined by the applicable fixed value, pattern, or required ValueSet binding.

[exists](#exists)

The slices are differentiated by the presence or absence of the nominated element. There SHALL be no more than two slices. The slices are differentiated by the fact that one must have a max of 0 and the other must have a min of 1 (or more). The order in which the slices are declared doesn't matter.

[pattern](#pattern)

The slices have different values in the nominated element, as determined by the applicable fixed value, pattern, or required ValueSet binding. This has the same meaning as 'value' and is deprecated.

[type](#type)

The slices are differentiated by type of the nominated element.

[profile](#profile)

The slices are differentiated by conformance of the nominated element to a specified profile. Note that if the path specifies .resolve() then the profile is the target profile on the reference. In this case, validation by the possible profiles is required to differentiate the slices.

[position](#position)

The slices are differentiated by their index. This is only possible if all but the last slice have min=max cardinality, and the (optional) last slice contains other undifferentiated elements.

The FHIRPath statement that allows for the selection of the element on which the discriminator is based is a restricted FHIRPath statement that is allowed to include:

-   Element selections (e.g. FHIRPath statements without "()" such as `component.value`)
-   The function `extension(url)` to allow selection of a particular extension
-   The function `resolve()` to allow slicing across resource boundaries
-   The function `ofType()` to allow choosing a type in a polymorphic element

See the [full details about the restricted FHIRPath statement](fhirpath.html#simple).

Further notes about the use of the different discriminator types:

value

This is the most commonly used discriminator type: to decide based on the value of an element as specified by a fixed value, a pattern value, or a required value set binding. Typical example: slice on the value of `Patient.telecom.system`, for values phone, email, or slice on the value of `Observation.code`, for values LOINC codes 1234-5, 4235-8 etc. There are [some examples of slicing](elementdefinition-examples.html#pattern-examples) based on discriminator-type `value` with patterns.

pattern

This code means the same as value, and is retained for backwards compatibility reasons

exists

This is not used commonly - it only has 2 values, so not much discrimination power. It's mainly used as an adjunct slicing criteria along with other discriminators. Elements used like this are mostly complex backbone elements. The slices are differentiated by the presence or absence of the nominated element. There SHALL be no more than two slices. The slices are differentiated by the fact that one must have a max of 0 and the other must have a min of 1 (or more). The order in which the slices are declared doesn't matter. Typical example: slice on the pattern of Observation.code and the presence of Observation.component.

type

Used to match slices based on the type of the item. While it can be used with polymorphic elements such as `Observation.value[x]`, mostly it is used with Resource types on references, to apply different profiles based on the different resource type. Typical example: slice on the type of `List.item.resolve()` for the types Patient, RelatedPerson.

profile

Used to match slices based on the whether the item conforms to the specified profile. This provides the most power, since the full range of profiling capabilities are available, but it is also the hardest to implement, and requires the most processing (>1000-fold compared to the others). Implementers should use this only where absolutely required. Typical example: slice on the type of `Composition.section.entry().resolve()` for the profiles Current-Clinical-Condition, Past-Medical-Event, etc.

position

Used to match slices based on their index. This is only possible if all but the last slice have a fixed cardinality where `min` > 0 and `min` = `max`. The last slice MAY have `min` != `max`. Typical example: slice on Practitioner.name to require that the first name be the usual name for the practitioner, and it must be present

Each slice must use the [element definition](elementdefinition.html) for the element(s) in the discriminator(s) to ensure that the slices are clearly differentiated by assigning an appropriate value domain, depending on the discriminator type. If the type is `value`, or `pattern`, then the element definition must use either:

-   [ElementDefinition.fixed\[x\]](elementdefinition-definitions.html#ElementDefinition.fixed_x_), or
-   [ElementDefinition.pattern\[x\]](elementdefinition-definitions.html#ElementDefinition.pattern_x_), or
-   if the element has a terminology binding, a required binding with a [Value Set](valueset.html#required) that enumerates the list of possible codes in the value set ("formally called an 'Extensional' value set")

It is the composite (combined) values of the discriminators that are unique, not each discriminator alone. For example, a slice on a list of items that are references to other resources could designate fields from different resources, where each resource only has one of the designated elements, as long as they are distinct across slices.

A structure definition is not required to designate any discriminator at all for a slice, but those that don't identify discriminators are describing content that is very difficult to process, and so this is discouraged.

Within a structure definition, a slice is defined using multiple _element_ entries that share a _path_ but have distinct _name_s. These entries together form a "slice group" that is:

1.  **Initiated by a "slicing entry"** That is, the first _element_ in a slice group must contain a _slicing_ property that defines the _discriminator_ for all members of the group. It also contains the unconstrained definition of the element that is sliced, potentially including children of the unconstrained element, if there are any
2.  **Mutually exclusive**. This means that each _element_ in a slice group SHALL describe a distinct set of values for the group's _discriminators_. Because of this constraint, an element in a resource **instance** will never match more than one _element_ in a given slice group. If no discriminators are named, it SHOULD still be possible to differentiate the slices based on their properties, though it may be substantially harder to do so.
3.  **Serialized as a group**. The entries in a slice group must be **adjacent** in a serialized structure definition, **or**, if there are any intervening elements, those elements must be "compatible with" the group. Concretely, this means that any intervening elements must have a _path_ that starts with the slice group's _path_. For example, an _element_ with a _path_ of _Observation.name.extension_ would be compatible with (and thus, would not "break up") a slice group whose path was _Observation.name_

Some examples of discriminators:

**Context**

**Discriminator Type**

**Discriminator Path**

**Interpretation**

List.entry

value

item.resolve().name

Entries are differentiated by the name element on the target resource - probably an observation, which could be determined by other information in the profile

List.entry

type

item.resolve()

Entries are differentiated by the type of the target element that the reference points to

List.entry

profile

item.resolve()

Entries are differentiated by a profile tag on the target of the reference, as specified by a structure definition in the profile

List.entry

value

item.extension('http://acme.org/extensions/test').value

Entries are differentiated by the value of the code element in the extension with the designated URL

List.entry.extension

value

url

Extensions are differentiated by the value of their url property (usually how extensions are sliced)

List.entry

type, value

item.resolve(), item.resolve().value

Entries are differentiated by the combination of the type of the referenced resource, and, if it has one, the code element of that resource. This would be appropriate for where a List might be composed of a Condition, and set of observations, each differentiated by its name - the condition has no name, so that is evaluated as a null in the discriminator set

EndPoint.header

value

value

Slicing a primitive field by value, e.g. to specify a set list of headers in a profile

Observation.value\[x\]

type

$this

Different constraints (e.g. "must support", usage notes, vocabulary bindings, etc.) are asserted for different supported types for the multi-typed element Observation.value\[x\]

Notes:

-   The discriminator types of type and profile can also be used where a repeating element contains a resource directly (e.g. [DomainResource.contained](domainresource-definitions.html#DomainResource.contained), [Bundle.entry](bundle-definitions.html#Bundle.entry), [Parameters.parameter.resource](parameters-definitions.html#Parameters.parameter.resource)).
-   The [examples of slicing and discriminators](profiling-examples.html) show exactly how this and other typical uses of slicing are represented in profiles.
-   Note that extensions are always sliced by the `url` element, though they may be resliced on additional elements where required.
-   With regard to the use of `resolve()`, any elements that are specified in the discriminator path beyond the resolve() function (e.g. 'name' in item.resolve().name) are referring to the corresponding element in the resource identified by the `reference`, as constrained by the applicable `targetProfile` (regardless of the discrinator type), and it is in the profile that the `targetProfile` refers to where a fixed value or pattern for the element must be declared. The targetProfile itself is declared in the element in the slice that immediately precedes the resolve() function in the discriminator path (e.g. 'item' in item.resolve().name), and that element is the final element that the slice declares.

### 5.1.0.14 Slice Cardinality[](profiling.html#slice-cardinality "link to here")

When an element of a fixed cardinality m..n is sliced, the following rules apply:

-   The maximum cardinality on each slice cannot exceed `n`
-   The sum of the maximum cardinalities can be larger than `n`
-   The sum of the minimum cardinalities must be less or equal to `n`
-   Each individual slice can have a minimum cardinality of 0 (less than `m` - the only situation where this is allowed), but the total number of elements in the instance must still be greater or equal to `m`
-   The sum of the minimum cardinalities of the slices SHOULD be less than or equal to `m`. The cardinality of the sum of the slice minimums must be met as well as the minimum on the base element.

### 5.1.0.15 Default Slice[](profiling.html#default-slice "link to here")

There is a special slice, called the default slice. This allows a profile to describe a set of specific slices, and then make a set of rules that apply to all of the remaining content that is not in one of the defined slices. Some rules about the default slice:

-   It is identified because the name of the slice is `@default`. The sliceName '@default' is reserved and cannot be used in any other context
-   Default slices are only allowed when the slicing rule = closed
-   Default slices must not fix the value of the discriminator elements
-   Default slices can be re-sliced in dependent profiles

One use of a default slice would be the case where the profile slices an identifier element to require a set of known identifiers, where the `type` element is prohibited (since they are known identifiers) but requires `type` on all other identifiers if any are present. In this case, the default slice makes no rules about the identifier.system (which is the slicing discriminator), but fixes the cardinality of type to 1..1 in the @default slice.

### 5.1.0.16 Profiling portions of a resource[](profiling.html#partial "link to here")

In all the examples above, a profile is applied to an entire resource, and re-useability is at the scope of the entire resource. It is possible, however, to apply a profile at the point of a particular element in a resource. A common case where this would be useful is for section templates in a profile on Composition, where it is common to have a set of rules for the content of a section that are used across multiple different documents (profiles on Composition). This is supported by the [profile-element](https://build.fhir.org/ig/HL7/fhir-extensions/StructureDefinition-elementdefinition-profile-element.html) extension.

The profile-element extension is an instruction to a validator to apply the profile starting at the nominated element (by its ID). To use this, a profile author would first define a profile on Composition section:

```
  <StructureDefinition xmlns="http://hl7.org/fhir"> 
    ...
    <url value="http://hl7.org/fhir/example/StructureDefinition/document-section-library">
    <!-- this profile is 'abstract' - it defines a library of sections, 
     so it doesn't make sense to use it as a profile directly -->
    <abstract value="true"/>
    <!-- this profile applies rules to the Composition resource -->
    <type value="Composition"/>
    <baseDefinition value="http://hl7.org/fhir/StructureDefinition/Composition"/>
    <derivation value="constraint"/>
    <differential>
        <!-- set up slicing on Composition.section - by section.code in this case. 
          This slicing is never used anywhere since this library is abstract,
          but it's needed for presenting the library coherently 
          e.g. in an implementation guide
        -->  
        <element>
        <path value="Composition.section"/>
        <slicing>  
          <discriminator> 
            <type value="value"/>
            <path value="code"/>
          </discriminator>
          <description value="Slice by .section.code when using this section library"/>
          <ordered value="true"/>
          <rules value="closed"/>
         </slicing>
      </element>

      <!-- 
        a set of rules on a composition section
        The value of the id is fixed by the rules on 
        StructureDefinition/ElementDefinition
      -->
      <element id="Composition.section:codeB"> 
        <path value="Composition.section"/>
        <sliceName value="codeB"/>
      </element>
      <!-- simple rules for example: 
         there will be a title and the code will at least contain code-b -->
      <element>
        <path value="Composition.section.title"/>
        <min value="1"/>
      </element>
      <element>
        <path value="Composition.section.code"/>
        <min value="1"/>
        <patternCodeableConcept>
          <coding>
            <system value="http://hl7.org/fhir/test/CodeSystem/imaginary"/>
            <code value="code-b"/>
          </coding>
        </patternCodeableConcept>
      </element>
   ...   

```

Then to apply the section level profile to an element:

```
  <element>
    <!-- Slice on Composition.section by the code.
     It's not necessary to slice to use this extension,
    but it normally be necessary to achieve the desired outcome
    -->  
    <path value="Composition.section"/>
    <slicing>  
      <discriminator> 
        <type value="pattern"/>
        <path value="code"/>
      </discriminator>
      <description value="Slice by .section.code"/>
      <ordered value="true"/>
      <rules value="closed"/>
     </slicing>
  </element>
  <element>
     <!-- first slice -->  
    <path value="Composition.section"/>
    <sliceName value="code-B"/>
    <min value="1"/>
    <type>
      <code value="BackboneElement"/> 
      <!-- the extension says where in the referenced profile to start -->
      <profile value="http://hl7.org/fhir/example/StructureDefinition/document-section-library">
        <extension url="http://hl7.org/fhir/StructureDefinition/elementdefinition-profile-element">
          <valueString value="Composition.section:codeB"/>
        </extension>
      </profile>
    </type>
  </element>  

```

### 5.1.0.17 Re-profiling and Re-slicing[](profiling.html#reslicing "link to here")

Profiles can be based on other profiles and can apply further constraints to those already specified. This is a useful technique, but implementers should be wary of over-use - humans have trouble understanding the implications of deep stacks of constraining profiles.

When a profile constrains another profile, it can make additional constraints, including extending the discriminator, adding new slices (if the slices are not already closed), and slicing inside the existing slices.

The rules for constraining ElementDefinition.slicing are as follows:

-   `ElementDefinition.slicing.rule` can be constrained from `open` to `closed`
-   `ElementDefinition.slicing.ordered` can be constrained from `false` to `true`
-   If a discriminator for an element is declared in a parent profile, child profiles referencing that element:
    -   SHALL include all the same discriminators
    -   MAY add additional discriminators

It's sometimes necessary to slice data that has already been sliced in the base profile - that is, create new slices within the existing slices. This is called "Re-slicing". The rules for re-slicing are as follows:

When you slice, you define a name for each new slice. The name has to be unique across the set of slices in the profile. So if profile A defines an element X with cardinality 0..\*, and profile B is derived from profile A, then profile B can either:

1.  make a constraint on X with no ElementDefinition.sliceName - in which case the profile is adding constraints to all slices of X; or
2.  make a constraint on X with an ElementDefinition.sliceName - in which case the profile is describing a specific slice on X, and the constraints only apply to that slice; or
3.  it can do both

Then, profile C derives from profile B. Profile C can do the following:

1.  make a constraint on X with no ElementDefinition.sliceName - in which case the profile is constraining all slices of X; or
2.  make a constraint on X with a different ElementDefinition.sliceName from that used in profile B - in which case the profile is describing a specific new slice on X, and the constraints only apply to that slice; or
3.  make a constraint on X with the same ElementDefinition.sliceName as that used in profile B - in which case the profile is making new constraints on the slice defined in profile B; or
4.  some combination of the above options

Note that it is possible for Profile C to make rules that are incompatible with profile B, in which case there is no set of instances that can be valid against profile C

In addition to the above, there are times when Profile C will need to further slice a slice defined in B. In this case, there's a need to reference both the ElementDefinition.sliceName of the original slice from Profile B as well as to define an ElementDefinition.sliceName for the slice defined within Profile C. This is done by separating the names using "/". For example, if Profile B defines the slice "example", and profile C defines the slice "example/example1", then this is deemed to be "example1" slice of the example slice. This process can continue indefinitely by separating each layer of slicing names with the "/" character. This pattern applies to @default too: @default/@default.

### 5.1.0.18 Extension Definitions[](profiling.html#extensions "link to here")

An extension definition defines the URL that identifies the extension and is used to refer to the extension definition when it is used in a resource.

The extension definition also defines the context where the extension can be used (usually a particular path or a datatype) and then defines the extension element using the same details used to profile the structural elements that are part of resources. This means that a single extension can be defined once and used on different resources and/or datatypes, e.g. one would only have to define an extension for "hair color" once, and then specify that it can be used on both Patient and Practitioner.

For further discussion of defining and using extensions, along with some examples, see [Extensibility](extensibility.html).

#### 5.1.0.18.1 Using Extensions in Profiles[](profiling.html#using-extensions "link to here")

Once defined, an extension can be used in an instance of a resource without any Profile declaring that it can, should or must be, but Profiles can be used to describe how an extension is used.

To prescribe the use of an extension in an instance, the extension list on the resource needs to be sliced. This is shown in [the extensibility examples](extensibility-examples.html#sliceextensions)

Note that the minimum cardinality of an extension SHALL be a valid restriction on the minimum cardinality in the definition of the extension. If the minimum cardinality of the extension is 1 when it is defined, it can only be mandatory when it is added to a profile. This is not recommended - the minimum cardinality of an extension should usually be 0.

### 5.1.0.19 Binding Definitions[](profiling.html#binding "link to here")

Coded elements have bindings that link from the element to a definition of the set of possible codes that the element may contain. The binding identifies the definition of the set of possible codes and controls how tightly the set of the possible codes is interpreted.

The set of possible codes is either a formal reference to a [ValueSet](valueset.html) resource, which may be version specific, or a general reference to some web content that defines a set of codes. The second is most appropriate where a set of values is defined by some external standard (such as mime types). Alternatively, where the binding is incomplete (e.g. under development) just a text description of the possible codes can be provided.

Bindings have a property that defines the degree of flexibility associated with the use of the codes in the value set. See [Binding Strength](terminologies.html#strength) for further information.

### 5.1.0.20 Additional Bindings[](profiling.html#additionalbindings "link to here")

When deriving an element from an element that has additional bindings, an additionalBinding can be constrained if it has the same key. If the base additionalBinding does not have a key, it cannot be constrained. Rules for constraining additionalBinding uses and value sets are the same as for constraining regular bindings.

### 5.1.0.21 Mixing Custom and Standard Terminologies[](profiling.html#tx "link to here")

[CodeSystem](codesystem.html) resources can be used to carry definitions of local codes ([Example](codesystem-example.html)) and [ValueSets](valueset.html) can mix a combination of local codes and standard codes (e.g. LOINC, SNOMED), or just to choose a particular set of standard codes (examples: LOINC, SNOMED, RxNorm). Profiles can bind to these value sets instead of the ones defined in the base specification, following these rules:

**[Binding Strength](terminologies.html#binding) in base specification**

**Customization Rules in Profiles**

required

The value set can only contain codes contained in the value set specified by the FHIR specification

extensible

The value set can contain codes not found in the base value set. These additional codes SHOULD NOT have the same meaning as existing codes in the base value set

preferred or example

The value set can contain whatever is appropriate for local use

Note that local codes are not as interoperable as standard published code systems (e.g. LOINC, SNOMED CT), so it is preferable to use standard code systems.

### 5.1.0.22 Changing Binding Strength in Profiles[](profiling.html#binding-strength "link to here")

A profile can change the terminology binding of an element - both strength and value set - within the limits of the base structure it is constraining. This table summarizes the changes that can be made to the binding strength:

derived (across)  
base (down)

required

extensible

preferred

example

required

yes

no

no

no

extensible

yes

yes

no

no

preferred

yes

yes

yes

no

example

yes

yes

yes

yes

Note that a constraining profile may leave the binding strength the same and change the value set instead. Whatever the constraining profile does, it cannot make codes valid that are invalid in the base profile.

### 5.1.0.23 Must Support / Implementation Obligations[](profiling.html#obligations "link to here")

One of the properties that can be declared on profiles but not on resource or datatype definitions is 'mustSupport', which is a boolean property. If true, it means that systems claiming to conform to a given profile must "support" the element. This is distinct from cardinality. It is possible to have an element with a minimum cardinality of "0", but still expect systems to support the element.

The meaning of "support" is not defined by the base FHIR specification, but it can be set to true in a profile. When a profile does this, it SHALL also make clear exactly what kind of "support" is required. Examples include:

-   The system must be able to store and retrieve the element
-   The system must display the element to the user and/or allow the user to capture the element via the UI
-   The element must appear in an output report
-   The element must be taken into account when performing decision support, calculations or other processing
-   etc.

The specific meaning of "Must Support" SHALL be defined. Profiles can do this in one of two ways:

-   They can provide detailed [">Obligations](obligations.html)
-   They can describe their expectations in `ElementDefinition.comment`, the general `StructureDefinition.description` or in other documentation for the implementation guide that includes the profile

If creating a profile based on another profile, Must Support can be changed from false to true, but cannot be changed from true to false. Obligations can be added, particularly for different actors, but existing actor obligations cannot be undone or loosened.

When one implementation guide or profile depends on another, the meaning of mustSupport defined in the base artifact applies to those elements marked as mustSupport in that base artifact. However, elements newly defined as mustSupport in the derived artifact take their definition of mustSupport from the new IG/profile. Note that it is possible for the new IG or profile to simply reference the mustSupport artifacts defined in an ancestor artifact if that is the behavior desired.

Note that an element that has the property IsModifier is not necessarily a "key" element (e.g. one of the important elements to make use of the resource), nor is it automatically mustSupport - however both of these things are more likely to be true for IsModifier elements than for other elements.

When a child element is defined as Must Support and the parent element isn't, a system must support the child if it support the parent, but there's no expectation that the system must support the parent.

If an Implementation Guide defines a complex element as Must Support, and does not declare any of its child elements as Must Support, then the Implementation Guide should provide further guidance; if there is no further guidance, then the expectation is that implementers must support at least a subset of the child elements of the must-support parent.

### 5.1.0.24 Managing Profile Complexity[](profiling.html#complexity "link to here")

The FHIR profile ecosystem has grown rapidly in volume and complexity, with the real-world profusion of use cases being faithfully represented in a profusion of related but different profiles. This specification recommends that profile designers consider these patterns to minimize the complexity to only that which must exist:

-   Profiles should derive from national base profiles whenever possible
-   Use-case Profiles embedded in a workflow should derive from an abstract profile that captures as many general application obligations as possible, since these are likely shared across the work flow in common.
-   Obligations should be associated with defined Actors whenever possible

### 5.1.0.25 Search Criteria[](profiling.html#search "link to here")

Implementations can define search criteria in addition to those defined in the specification itself. Search criteria fall into one of four categories:

1.  Enabling search on core elements that don't have standard search criteria defined (e.g. searching Observation by normal range)
2.  Enabling search on elements that already have standard search criteria defined, but with custom matching rules; e.g. a sounds-like search on Practitioner name
3.  Enabling search on an extension
4.  Enabling search that doesn't correspond to a single element but rather a combination of elements or computation on an element; e.g. searching for patients by age

Additional Search Parameters can be defined using the [SearchParameter](searchparameter.html) resource.

### 5.1.0.26 Presenting Profiles[](profiling.html#presentation "link to here")

When this specification describes a profile, the profile is presented in 5 different forms:

Text Summary

This presents a short summary human readable summary of the profile - a combination of the author's summary, and some automatically generated summary content

Differential Table

This is a view of the differential statement ([see above](#snapshot)). For context, additional information not in the differential is also shown partially transparent

Full Structure

This is a view of the snapshot produced by the profile ([see above](#snapshot)). The information is a comprehensive view of what the profile means, though inherited constraints are not presented

XML Template

An example of what the profile looks like in XML format

JSON Template

An example of what the profile looks like in JSON format

### 5.1.0.27 Supporting Multiple Profiles[](profiling.html#mixing "link to here")

Applications may be required to support more than one profile at a time. A typical example might be an EHR application that is required to support a general purpose data sharing profile (such as [DAF ![icon](external.png)](http://hl7.org/fhir/us/daf) ), and also must support specific profiles for decision support using the same interface.

The impact of supporting two sets of profiles depends on whether resources are being created or consumed. When an application is creating content, it must create content that conforms to both sets of profiles - that is, the intersection of the profiles. When an application is consuming information, then it must be able to consume content that conforms to either set of profiles - that is, the union of the profiles.

Since applications generally consume and produce resources at the same time, conforming to more than one profile might not be possible, unless the profiles are designed to make statements at different levels - and the case above is one such case, where one profile is focused on data access, provenance, and availability, the other profile is focused on clinical content.

Accordingly, profiles can relate to each other in four different ways. Each profile can be thought of in terms of the set of instances that conform to the profile:

1.  Non-overlapping: there no instances that conform to profiles A & B (technically, the intersection of profiles A & B is an empty set)
2.  Partly overlapping: some instances conform to both A & B, but others only conform to A or B
3.  One set contained in the other: all resources that conform to A conform to B, but only some of the ones that conform to B conform to A (or vice versa)
4.  Identical sets: the set of resources that conform to A is the same as the set of resource that conform to B and the set of resources that don't conform to A is the same as the set of resources that don't conform to B

The following guidance for designing profiles will maintain broader compatibility of resource instances across diverse profiles and minimize non-overlapping profiles of a given resource type:

-   Omit elements from the profile if they are not required for a specific use case. Profile authors are discouraged from prohibiting the element (min= 0).
-   When profiling coded values, profile authors are encouraged to allow additional Codings in an instance, and use [extensible](terminologies.html#extensible) and [preferred](terminologies.html#preferred) bindings instead of [required](terminologies.html#required) bindings when possible.

Profiles can be compared to determine their compatibility. See [Comparing Profiles ![icon](external.png)](https://confluence.hl7.org/display/FHIR/Comparing+Profiles) on the HL7 Confluence page.

FHIR ®© HL7.org 2011+. FHIR R6 hl7.fhir.core#6.0.0-ballot3 generated on Fri, Sep 12, 2025 20:28+0000.  
Links: [Search ![icon](external.png)](http://hl7.org/fhir/search.cfm) | [Version History](history.html) | [Contents](toc.html) | [Glossary](help.html) | [QA](qa.html) | [Compare to R5 ![icon](external.png)](https://www5.aptest.com/standards/htmldiff/htmldiff.pl?oldfile=http%3A%2F%2Fhl7.org%2Ffhir%2FR5%2Fprofiling.html&newfile=http%3A%2F%2Fbuild.fhir.org%2Fprofiling.html) | [![CC0](cc0.png)](license.html) | [Propose a change ![icon](external.png)](https://jira.hl7.org/secure/CreateIssueDetails!init.jspa?pid=10405&issuetype=10600&customfield_11302=FHIR-core&customfield_11808=R5&customfield_10612=http://build.fhir.org/profiling.html)