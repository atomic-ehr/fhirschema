# How to Slice an FHIR Resource

Posted: July 12, 2022 | Updated: September 15, 2024

Navigate the complexities of slicing FHIR resources with our hands-on guide. Understand the step-by-step method of slicing an FHIR element and discover how discriminators function in value and pattern slicing. This article is an invaluable reference for those getting started with FHIR or looking to refine their skills.

The [FHIR specification](https://hl7.org/fhir/profiling.html#slicing) doesn’t go too in-depth about slicing, either. As such, we wanted to create a clear and concise guide that could serve as a point of reference for those just starting with FHIR, as well as those who want to polish their skills. 

## **FHIR Slicing in Simple Words**

Essentially, FHIR slicing is the “if . . . then” validation based on profile. You “slice” an element by splitting it into multiple instances. We use slicing to create different validations on the same group of fields that depend on the value of one of the fields in the group. 

So when you need to use a specific element of a resource more than once, you just copy the element in the process of slicing.

For example, we want to create different rules for different patient contacts. 

-   If contact = _Insurance Company_, then _Patient.contact.organization_ is mandatory, 
-   if contact = _Emergency Contact_, then _telecom_ is mandatory, 
-   if contact = _Contact Person_, then relationship is mandatory and _address.use_ should be _home_, etc.

So, we create different validations to the same field, based only on the value of _Patient.contact_.

## How FHIR slicing works

In order to slice an element, we first should understand what steps an FHIR server performs when validating a slicing operation. To distinguish how a server processes different slices, we define a “discriminator.” There are multiple ways of doing it, but we commonly use two types of slicing in FHIR: _value_ and _pattern_. (Both types are supported by our [Kodjin FHIR Server](https://kodjin.com/))

**If the slicing discriminator is value** (discriminator value implies fixed\[x\] value in the profile), then the FHIR server tries to find the same fields in the same order that are in the fixed\[x\] value. 

For example, if _fixed_ is “_fixedString_”=”_123,_” then the FHIR server will try to find the path _slicing.discriminator.path_ string with the value “_123._”

If fixed is:

```
CodeableConcept: {
“system”:”example.com”, 
“code”=”123”
},
```

then the FHIR server will try to find exactly the same _CodeableConcept_. 

And 

```
CodeableConcept: {
“code”=”123”, 
“system”:”example.com”
}
```

is not exactly the same.

After the FHIR server finds the value, it will validate the received data against the data snippet that contains the given value. After, it will validate the order of the data if _slicing.ordered=true_. If not found, it will check if _slicing.rule=open_ and will validate against the _All_ slices snippet. In case _slicing.rule=close_, it will return an error.

**If the slicing discriminator is a pattern** (discriminator value implies pattern\[x\] value in the profile), logically, the validation is similar to “_value,_” but data that is searched by the FHIR server doesn’t need to be exactly the same with the same order; it should only have the same values. 

In pattern slicing 

```
CodeableConcept: {
“system”:”example.com”, 
“code”=”123”
},
```

and request

```
CodeableConcept: {
“code”=”123”, 
“system”:”example.com”
}
```

will trigger slicing validation.

## FHIR Slicing Practical Case Example

We will use one of the Carin Blue Button profiles (Payer Data Exchange profiles), which have powerful slicing to explain slicing rules better. The profile we will look at is the [ExplanationOfBenefit-Inpatient profile](https://build.fhir.org/ig/HL7/carin-bb/StructureDefinition-C4BB-ExplanationOfBenefit-Inpatient-Institutional.html). In this example, we have slicing in the “supporting info” element. Supporting info is a BackboneElement with a group of fields.

![](https://kodjin.com/wp-content/uploads/2022/07/screenshot-2022-07-12-at-14.44.29-1024x273.png)

Source: [FHIR.org](https://build.fhir.org/ig/HL7/carin-bb/StructureDefinition-C4BB-ExplanationOfBenefit-Inpatient-Institutional.html)

Those fields could be validated by common rules (_supportingInfo: All Slices)_ or by slicing rules. 

For easier understanding, we defined different types of rules depending on _sliceName_ and FHIR slice path in the table below.

**sliceName**

**category.system**

**category.code**

**code**

**timing**

billingnetworkco  
ntractingstatus

http://hl7.org/fhir/us/carin-bb/CodeSystem/C4BBSupportingInfoType

billingnetworkcont racingstatus

http://hl7.org/fhir/us/carin-bb/ValueSet/C4BBPayerProviderContractingStatus

pointoforigin

http://hl7.org/fhir/us/carin-bb/CodeSystem/C4BBSupportingInfoType

pointoforigin

http://hl7.org/fhir/us/carin-bb/ValueSet/AHANUBCPointOfOriginForAdmissionOrVisit

typeofbill

http://hl7.org/fhir/us/carin-bb/CodeSystem/C4BBSupportingInfoType

typeofbill

http://hl7.org/fhir/us/carin-bb/ValueSet/AHANUBCTypeOfBill

clmrevcddate

http://hl7.org/fhir/us/carin-bb/CodeSystem/C4BBSupportingInfoType

clmrevcddate

date

admissionperiod

http://hl7.org/fhir/us/carin-bb/CodeSystem/C4BBSupportingInfoType

admissionperiod

period

All mandatory fields and their differences are defined with _All slice_ rules. For example, sliceName “_billingnetworkcontractingstatus_” says that _ExplanationOfBenefit.supportingInfo.code_ is mandatory, while it is optional for _sliceName_ “_clmrecvddate._” Or _Timing_ is mandatory for _sliceName_ “_clmrecvddate_” and should be “_date,_” but for “_admissionperiod,_” it should be period only, etc.

  
In the Carin Blue Button profile, FHIR slices are created on the field _“category_”—the full path is “_ExplanationOfBenefit.supportingInfo.category._”

```
"slicing" : {
          "discriminator" : [
            {
              "type" : "pattern",
              "path" : "category"
            }
          ],
          "description" : "Slice based on $this pattern",
          "ordered" : false,
          "rules" : "open"
        }
```

Category is a _CodeableConcept_. So with the type “_pattern,_” we can send system, value, and other fields of CodeableConcept in any order and any fields. The slicing will be triggered if all fields defined in the structure definition will be present in the resource separately.

**In the example, “ordered”** is false, showing that the order of FHIR slices in a resource is not important. We can create resources with supporting info with code “_​​clmrecvddate_” before “_admissionperiod._”

```
"supportingInfo" :
    {
      "sequence" : 2,
      "category" : {
        "coding" : [
          {
            "system" : "http://hl7.org/fhir/us/carin-bb/CodeSystem/C4BBSupportingInfoType",
            "code" : "clmrecvddate",
            "display" : "Claim Received Date"
          }
        ],
        "text" : "Date the claim was received by the payer."
      },
      "timingDate" : "2017-06-01"
    },
    {
      "sequence" : 3,
      "category" : {
        "coding" : [
          {
            "system" : "http://hl7.org/fhir/us/carin-bb/CodeSystem/C4BBSupportingInfoType",
            "code" : "admissionperiod",
            "display" : "Admission Period"
          }
        ],
        "text" : "Dates corresponding with the admission and discharge of the beneficiary to a facility"
      },
      "timingPeriod" : {
        "start" : "2017-05-23"
      }
    }
  ]
```

In case the order is true, then we should put in the resource supporting info with _category.coding.code=admissionperiod_ before the supporting info with _category.coding.code=clmrecvddate_ like in the FHIR slicing rules.

## Takeaway

We hope you will find this article useful, and it has helped you get a better grasp of what FHIR slicing is and how to do it. Authoring FHIR profiles is a time-consuming process that requires a high skill set.

Our team has created a free [Kodjin FHIR profiling tool](https://kodjin.com/fhir-profiler/), that makes a lot of the steps involved in creating and managing profiles considerably easier. Kodjin FHIR profiler will validate your profiles, enable syntax control, and provide visualization of FHIR resource structure trees and resource snapshot generated from differential descriptions. Try it out for yourself either as a VS (Visual Studio) plugin or in your browser!

If you are looking to create custom FHIR profiles or need help with [FHIR implementation](/blog/implementation-guide-how-to-implement-fhir/), our team of FHIR  Business Analysts can help you fill in that skill gap. [Contact us](https://kodjin.com/contact-us/) to discuss your project and how we can help.

#### Post author

![](https://kodjin.com/wp-content/uploads/2023/08/sveta_vedmed.jpeg)

#### Sveta Vedmed

Business Analyst at Edenlab

-   [](https://www.linkedin.com/in/sveta-vedmed-a42424100/)

#### Post author

![](https://kodjin.com/wp-content/uploads/2023/08/sveta_vedmed.jpeg)

#### Sveta Vedmed

Business Analyst at Edenlab

-   [](https://www.linkedin.com/in/sveta-vedmed-a42424100/)

[![Kodjin Interoperability Suite](https://kodjin.com/wp-content/uploads/2023/07/kodjin-interoperability-suite_cover-1.jpg)](https://kodjin.com/whitepapers/fhir-based-enterprise-level-tools-for-healthcare-data-management/)

[

#### Everything About Kodjin Interoperability Suite in One Place

](https://kodjin.com/whitepapers/fhir-based-enterprise-level-tools-for-healthcare-data-management/)[Download](https://kodjin.com/whitepapers/fhir-based-enterprise-level-tools-for-healthcare-data-management/)

## More article about Featured Articles and Highlighted Insights

[

![](https://kodjin.com/wp-content/uploads/2024/03/12.jpg)

](https://kodjin.com/blog/how-to-validate-profiles-with-fhirpath/)

[FHIRPath Profile Validation: Real-World Examples](https://kodjin.com/blog/how-to-validate-profiles-with-fhirpath/)

March 19, 2024

-   Featured
-   FHIR

[

![](https://kodjin.com/wp-content/uploads/2023/04/61.jpg)

](https://kodjin.com/blog/introduction-to-fhir-data-model/)

[HL7 FHIR Data Model Explained: Resources and Tools](https://kodjin.com/blog/introduction-to-fhir-data-model/)

April 21, 2023

-   Featured
-   FHIR

[

![](https://kodjin.com/wp-content/uploads/2023/04/80.jpg)

](https://kodjin.com/blog/fhir-vs-hl7-key-differences-and-which-is-a-better-choice/)

[FHIR vs. HL7: Which Standard Fits Your Healthcare Project?](https://kodjin.com/blog/fhir-vs-hl7-key-differences-and-which-is-a-better-choice/)

February 1, 2023

-   Featured
-   FHIR

[

![](https://kodjin.com/wp-content/uploads/2023/01/83.jpg)

](https://kodjin.com/blog/how-to-mapping-healthcare-data-to-hl7-fhir-resources/)

[FHIR Data Mapping in Healthcare: Meaning, Key Benefits and Solutions](https://kodjin.com/blog/how-to-mapping-healthcare-data-to-hl7-fhir-resources/)

December 8, 2022

-   Featured
-   FHIR

[

![](https://kodjin.com/wp-content/uploads/2023/01/84.jpg)

](https://kodjin.com/blog/smart-on-fhir-facilitating-healthcare-interoperability/)

[SMART on FHIR: A Guide to Developing Interoperable Apps](https://kodjin.com/blog/smart-on-fhir-facilitating-healthcare-interoperability/)

November 21, 2022

-   Featured
-   FHIR

## Let\`s chat

We would be glad to share more details about our enterprise-level FHIR software solutions and other cases based on the HL7 FHIR standard.

      

Name

Company

Business email

Message

By submitting this form, I agree to allow the processing of my personal data and to receive commercial and marketing communications as per the Edenlab Privacy Policy.

Please leave this field empty.         

Δ

## Your form has been submitted successfully

We will contact your shortly

Send again

[](https://kodjin.com)

##### Follow us

-   [](https://www.facebook.com/edenlabIT)
-   [](https://www.linkedin.com/company/edenlab-it)
-   [](https://twitter.com/EdenlabIT)

##### Solutions

-   [Kodjin FHIR Server](https://kodjin.com/kodjin-fhir-server/)
-   [Kodjin FHIR Terminology Service](https://kodjin.com/terminology-service/)
-   [Kodjin Data Mapper](https://kodjin.com/mapper/)
-   [FHIR Facade](https://kodjin.com/fhir-facade/)
-   [Kodjin ETL Solution](https://kodjin.com/healthcare-elt-extensive-solution/)
-   [Kodjin ONC Compliance Solution](https://kodjin.com/onc-compliance-solution/)
-   [Kodjin Analytics](https://kodjin.com/healthcare-analytics-solutions/)

##### Services

-   [Custom FHIR development](https://kodjin.com/service/custom-fhir-development-services/)
-   [FHIR Facade](https://kodjin.com/fhir-facade/)
-   [FHIR Consulting](#)
-   [FHIR Compliance](#)
-   [Courses and trainings](#)

##### Resources

-   [Blog](https://kodjin.com/blog/)
-   [What is FHIR?](https://kodjin.com/what-is-fhir/)
-   [White Papers](https://kodjin.com/white-papers/)
-   [Webinars](https://kodjin.com/webinars/)
-   [Case Studies](https://kodjin.com/cases/)
-   [Use Cases](https://kodjin.com/cases/)

##### Free FHIR Tools

-   [Kodjin FHIR Profiler](https://kodjin.com/fhir-profiler/)

-   ##### [Company](https://kodjin.com/about/)
    
-   ##### [Docs](https://docs.kodjin.com/)
    
-   ##### [Contact us](https://kodjin.com/contact-us/)
    

Kodjin Interoperability Suite made by [Edenlab](https://edenlab.io/) is a custom software and product development company with a primary focus on healthcare data interoperability.

Address: Vesivärava str. 50-201, 10152, Tallinn, Estonia

-   [Privacy Policy](https://kodjin.com/privacy-policy/)
-   [Terms of service](https://kodjin.com/terms-of-use)
-   [Web Accessibility Statement](https://kodjin.com/web-accessibility-statement/)

## Let\`s chat

We would be glad to share more details about our enterprise-level FHIR software solutions and other cases based on the HL7 FHIR standard.

      

Name

Company

Business email

Message

By submitting this form, I agree to allow the processing of my personal data and to receive commercial and marketing communications as per the Edenlab Privacy Policy.

Please leave this field empty.         

Δ

## Your form has been submitted successfully

We will contact your shortly

Send again

![](https://kodjin.com/wp-content/uploads/2024/04/ezeuht7a.jpeg)

## Kodjin White Paper

Please leave your email to get Kodjin White Paper

      

Name

Business email

By submitting this form, I agree to allow the processing of my personal data and to receive commercial and marketing communications as per the Edenlab Privacy Policy.

Please leave this field empty.           

By downloading files from this site you agree to the [Policy](/privacy-policy)

Δ

## The Kodjin White Paper has been successfully sent to your email

We have sent a copy to your email

Back to website content

  

 

Generic selectors

Exact matches only

Search in title

Search in content

Post Type Selectors