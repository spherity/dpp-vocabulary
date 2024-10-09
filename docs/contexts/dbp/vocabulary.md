---
slug: /dbp
sidebar_position: 1
title: Digital Battery Passport
---

## 1 Abstract

This specification describes an experimental vocabulary for asserting a DBP.

Click here to open the JSON-LD file: [dbp.jsonld](https://dpp.spherity.com/contexts/dbp/v1.jsonld)

## 2 Use Case and Requirements

## 3 Examples

https://github.com/spherity/dpp-vocabulary/blob/main/docs/contexts/dbp/credentials/dbp.jsonld

## 4 Information Model

### Credential Subjects

```mermaid
classDiagram

    class DigitalBatteryPassport{
        <<credentialSubject>>
        id
        generalInformation
        carbonFootprint
        circularity
        materialComposition
        performanceAndDurability
        labelsAndCertification
        dueDiligence
    }
    class GeneralInformation{
        <<anonymous>>
        productIdentifier
        productPassportIdentifier
        batteryCategory
        manufacturerIdentification
        manufacturingDate
        batteryStatus
        batteryWeight
        manufacturingPlace
        economicOperator
    }
    class CarbonFootprint{
        <<anonymous>>
        batteryCarbonFootprint
        carbonFootprintPerLifecycleStage
        carbonFootprintPerformanceClass
        carbonFootprintStudy
    }
    class Circularity{
        <<anonymous>>
        dismantlingAndRemovalInformation
        sourceForSpareParts
        recycledContent
        safetyRequirements
        endOfLifeInformation
        renewableContent
    }
    class MaterialComposition{
        <<anonymous>>
        criticalRawMaterials
        productChemistry
        batteryMaterials
        hazardousSubstances
    }
    class PerformanceAndDurability{
        <<credentialSubject>>
        digitalBatteryPassportId
        powerCapability
        batteryLifetime
        temperatureConditions
        negativeEvents
        technicalSpecification
        internalResistance
        roundtripEfficiency
        dynamicAttribute
    }
    class LabelsAndCertification{
        <<anonymous>>
        declarationOfConformity
        resultOfTestReport
        euDeclarationOfConformityId
        separateCollection
        materialSymbols
    }
    class DueDiligence{
        <<anonymous>>
        supplyChainDueDiligenceReport
        thirdPartyAussurances
        euTaxonomyDisclosureStatement
        sustainabilityReport
    }
    
    DigitalBatteryPassport "1" *-- "1" GeneralInformation
    DigitalBatteryPassport "1" *-- "1" CarbonFootprint
    DigitalBatteryPassport "1" *-- "1" Circularity
    DigitalBatteryPassport "1" *-- "1" MaterialComposition
    PerformanceAndDurability "1..n" o-- "1" DigitalBatteryPassport
    DigitalBatteryPassport "1" *-- "1" LabelsAndCertification
    DigitalBatteryPassport "1" *-- "1" DueDiligence
```
### GeneralInformation
```mermaid
classDiagram
    class GeneralInformation{
        <<anonymous>>
        productIdentifier
        productPassportIdentifier
        batteryCategory
        manufacturerIdentification
        manufacturingDate
        batteryStatus
        batteryWeight
        manufacturingPlace
        economicOperator
    }
```
### CarbonFootprint
```mermaid
classDiagram
    class CarbonFootprint{
        <<anonymous>>
        batteryCarbonFootprint
        carbonFootprintPerLifecycleStage
        carbonFootprintPerformanceClass
        carbonFootprintStudy
    }
    class CarbonFootprintPerLifecycleStage{
        <<anonymous>>
        lifeCycleStage
        carbonFootprint
    }
    CarbonFootprint "1" *-- "n" CarbonFootprintPerLifecycleStage
```
### Circularity
```mermaid
classDiagram
    class Circularity{
        <<anonymous>>
        dismantlingAndRemovalInformation
        sourceForSpareParts
        recycledContent
        safetyRequirements
        endOfLifeInformation
        renewableContent
    }
    class DismantlingAndRemovalInformation {
        <<anonymous>>
        documentType
        mimeType
        documentURL
    }
    class SourceForSpareParts {
        <<anonymous>>
        nameOfSupplier
        components
        supplierWebAddress
        emailAddressOfSupplier
        addressOfSupplier
    }
    class Components {
        <<anonymous>>
        partName
        partNumber
    }
    class RecycledContent {
        <<anonymous>>
        preConsumerShare
        recycledMaterial
        postConsumerShare
    }
    class SafetyRequirements {
        <<anonymous>>
        safetyInstructions
        extinguishingAgent
    }
    class EndOfLifeInformation {
        <<anonymous>>
        separateCollection
        wastePrevention
        informationOnCollection
    }
    Circularity "1" *-- "n" DismantlingAndRemovalInformation
    Circularity "1" *-- "n" SourceForSpareParts
    SourceForSpareParts "1" *-- "n" Components
    Circularity "1" *-- "n" RecycledContent
    Circularity "1" *-- "n" SafetyRequirements
    Circularity "1" *-- "n" EndOfLifeInformation
    
   
```
### MaterialComposition
```mermaid
classDiagram
    class MaterialComposition{
        <<anonymous>>
        criticalRawMaterials
        productChemistry
        batteryMaterials
        hazardousSubstances
    }
    class ProductChemistry{
        <<anonymous>>
        componentName
        componentId
    }
    class BatteryMaterials{
        <<anonymous>>
        materialIdentifier
        batteryMaterialName
        batteryMaterialWeight
        batteryMaterialLocation
    }
    class BatteryMaterialLocation {
        <<anonymous>>
        componentName
        componentID
    }
    class HazardousSubstances {
        <<anonymous>>
        hazardousSubstanceClass
        hazardousSubstanceConcentration
        hazardousSubstanceImpact
        hazardousSubstanceIdentifier
        hazardousSubstanceLocation
        hazardousSubstanceName
    }
    class HazardousSubstanceLocation {
        <<anonymous>>
        componentName
        componentId 
    }

    MaterialComposition "1" *-- "n" ProductChemistry
    MaterialComposition "1" *-- "n" BatteryMaterials
    BatteryMaterials "1" *-- "1" BatteryMaterialLocation
    MaterialComposition "1" *-- "n" HazardousSubstances
    HazardousSubstances "1" *-- "1" HazardousSubstanceLocation
    
```
### PerformanceAndDurability
```mermaid
classDiagram

    class PerformanceAndDurability{
        <<credentialSubject>>
        digitalBatteryPassportId
        powerCapability
        batteryLifetime
        temperatureConditions
        negativeEvents
        technicalSpecification
        internalResistance
        roundtripEfficiency
        dynamicAttribute
    }

    class PowerCapability{
        <<anonymous>>
        originalPowerCapability
        remainingPowerCapability
        powerCapabilityFade
        maximumPermittedBatteryPower
        powerCapabilityRatio
    }
    
    class BatteryLifeTime{
        <<anonymous>>
        lifetimeReferenceTest
        energyThroughput
        expectedNumberOfCycles
        cRate
        capacityThroughput
        capacityThresholdExhaustion
        soceThresholdForExhaustion
        warrantyPeriod
        putIntoService
        ratedCapacity
        numberOfFullCycles
    }
    
    class TemperatureCondiditions {
        <<anonymous>>
        temperatureRangeIdleState
        timeExtremeHighTemp
        timeExtremeLowTemp
    }
    
    class TechnicalSpecification {
        <<anonymous>>
        stateOfCertifiedEnergy
        ubeCertified
        ubeRemaining
        initialSelfDischarge
        remainingCapacity
        capacityFade
        stateOfCharge
        nominalVoltage
        minimumVoltage
        maximumVoltage
    }
    
    class InternalResistance {
        <<anonymous>>
        initialInternalResistancePack
        currentInternalResistancePack
    }
    
    class CurrentInternalResistancePack {
        <<anonymous>>
        currentInternalResistanceValue
        lastUpdate
    }
    
    class RoundtripEfficiency {
        <<anonymous>>
        initialSelfDischargingRate
        currentSelfDischargingRate
    }

   class CurrentSelfDischargingRate {
        <<anonymous>>
        currentSelfDischargingRateEntity
        lastUpdate
   }
   
    PerformanceAndDurability "1" *-- "1" PowerCapability
    PerformanceAndDurability "1" *-- "1" BatteryLifeTime
    PerformanceAndDurability "1" *-- "1" TemperatureCondiditions
    PerformanceAndDurability "1" *-- "1" TechnicalSpecification
    PerformanceAndDurability "1" *-- "1" InternalResistance
    InternalResistance "1" *-- "1" CurrentInternalResistancePack
    PerformanceAndDurability "1" *-- "1" RoundtripEfficiency
    RoundtripEfficiency "1" *-- "1" CurrentSelfDischargingRate
```

### LabelsAndCertification
```mermaid
classDiagram
    class LabelsAndCertification{
        <<anonymous>>
        declarationOfConformity
        resultOfTestReport
        euDeclarationOfConformityId
        separateCollection
        materialSymbols
    }
    class SeparateCollection {
        <<anonymous>>
        separateCollectionSymbol
        separateCollectionDescription
    }
    class MaterialSymbols {
        <<anonymous>>
        materialSymbol
        materialText
    }
    LabelsAndCertification "1" *-- "1" SeparateCollection
    LabelsAndCertification "1" *-- "n" MaterialSymbols
```
### DueDiligence
```mermaid
classDiagram
    class DueDiligence{
        <<anonymous>>
        supplyChainDueDiligenceReport
        thirdPartyAussurances
        euTaxonomyDisclosureStatement
        sustainabilityReport
    }
```



## 5 Classes

### 5.1 DigitalBatteryPassportCertificate {#DigitalBatteryPassportCertificate}

### 5.2 DigitalBatteryPassport {#DigitalBatteryPassport}

### 5.3 PerformanceAndDurability {#PerformanceAndDurability}

## 6 Properties

### 6.1 Properties of DigitalBatteryPassport

#### 6.1.1 generalInformation {#DigitalBatteryPassport_generalInformation}

##### 6.1.1.1 productIdentifier {#DigitalBatteryPassport_generalInformation_productIdentifier}

##### 6.1.1.2 productPassportIdentifier {#DigitalBatteryPassport_generalInformation_productPassportIdentifier}

##### 6.1.1.3 batteryCategory {#DigitalBatteryPassport_generalInformation_batteryCategory}

##### 6.1.1.4 manufacturerIdentification {#DigitalBatteryPassport_generalInformation_manufacturerIdentification}

##### 6.1.1.5 manufacturingDate {#DigitalBatteryPassport_generalInformation_manufacturingDate}

##### 6.1.1.6 batteryStatus {#DigitalBatteryPassport_generalInformation_batteryStatus}

##### 6.1.1.7 batteryWeight {#DigitalBatteryPassport_generalInformation_batteryWeight}

##### 6.1.1.8 manufacturingPlace {#DigitalBatteryPassport_generalInformation_manufacturingPlace}

##### 6.1.1.9 economicOperator {#DigitalBatteryPassport_generalInformation_economicOperator}

#### 6.1.2 carbonFootprint {#DigitalBatteryPassport_carbonFootprint}

##### 6.1.2.1 batteryCarbonFootprint {#DigitalBatteryPassport_carbonFootprint_}

##### 6.1.2.2 carbonFootprintPerLifecycleStage {#DigitalBatteryPassport_carbonFootprint_carbonFootprintPerLifecycleStage}

###### 6.1.2.2.1 lifeCycleStage {#DigitalBatteryPassport_carbonFootprint_carbonFootprintPerLifecycleStage_lifeCycleStage}

###### 6.1.2.2.2 carbonFootprint {#DigitalBatteryPassport_carbonFootprint_carbonFootprintPerLifecycleStage_carbonFootprint}

##### 6.1.2.3 carbonFootprintPerformanceClass {#DigitalBatteryPassport_carbonFootprint_carbonFootprintPerformanceClass}

##### 6.1.2.4 carbonFootprintStudy {#DigitalBatteryPassport_carbonFootprint_carbonFootprintStudy}

#### 6.1.3 circularity {#DigitalBatteryPassport_circularity}

#### 6.1.4 materialComposition {#DigitalBatteryPassport_materialComposition}

#### 6.1.5 labelsAndCertification {#DigitalBatteryPassport_labelsAndCertification}

#### 6.1.6 dueDiligence {#DigitalBatteryPassport_dueDiligence}

## References

* [Verifiable Credentials Data Model v2.0](https://www.w3.org/TR/vc-data-model-2.0). Manu Sporny, Ted Thibodeau Jr, Ivan Herman, Michael B. Jones, Gabe Cohen. 2024
