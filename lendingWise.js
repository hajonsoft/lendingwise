const { create } = require("xmlbuilder2");
const moment = require("moment");

let loan;

function createMismo(incomingLoan) {
  if (!incomingLoan) {
    return "Nothing to convert, Please pass a loan object or JSON";
  }
  if (typeof incomingLoan === "string" || incomingLoan instanceof String) {
    loan = JSON.parse(incomingLoan);
  } else {
    loan = incomingLoan;
  }
  let doc = create({
    version: "1.0",
    encoding: "UTF-8",
  }).ele("http://www.mismo.org/residential/2009/schemas", "MESSAGE", {
    "xmlns:xsi": "http://www.w3.org/2001/XMLSchema-instance",
    "xmlns:ULAD": "http://www.datamodelextension.org/Schema/ULAD",
    "xmlns:DU": "http://www.datamodelextension.org/Schema/DU",
    MISMOReferenceModelIdentifier: "3.4.032420160128",
    "xmlns:xlink": "http://www.w3.org/1999/xlink",
    "xmlns:LPA": "http://www.datamodelextension.org/Schema/LPA",
  });
  doc = container(doc, ["ABOUT_VERSIONS", "ABOUT_VERSION"]);
  doc = doc.ele("AboutVersionIdentifier").txt("S5.0.06").up();
  doc = doc.ele("CreatedDatetime").txt(moment().utc().format()).up();
  doc = doc.ele("DataVersionIdentifier").txt("5.0.06").up();
  doc = doc.root();
  doc = container(doc, [
    "DEAL_SETS",
    "DEAL_SET",
    "DEALS",
    "DEAL",
    "ABOUT_VERSIONS",
    "ABOUT_VERSION",
  ]);
  doc = doc.ele("DataVersionName").txt("").up();
  doc = doc.up().up();
  doc = container(doc, ["ASSETS"]);

  const borrowerAssets = loan["fileLOChekingSavingInfo"];
  doc = assets(doc, borrowerAssets);

            // const realEstateOwnedData = loanOwnedPropertyData(
            //   loan["fileLOScheduleRealInfo"]
            // );
            // doc = realEstateOwned(doc, realEstateOwnedData, borrowerAssets.length);

  const collateralData = [loan["LMRInfo"]];
  doc = collaterals(doc, collateralData);

  const contingentLiabilityData = loan["contingentLiabilities"];
  doc = contingentLiabilities(doc, contingentLiabilityData);

  const creditorInfoData = loan["creditorInfo"];
  doc = liabilities(doc, creditorInfoData);

  const loanData = [loan["LMRInfo"]];
  doc = loans(doc, loanData);

  const partyBorrowerData = [loan["LMRInfo"]];
  doc = partyBorrower(doc, partyBorrowerData);

  const hasCoborrower = loan["LMRInfo"].isCoBorrower == "1";
  if (hasCoborrower) {
    doc = partyCoBorrower(doc, partyBorrowerData, 1);
  }
  const brokerInfo = loan["BrokerInfo"];
  if (brokerInfo && brokerInfo.firstName) {
    doc = partyBroker(
      doc,
      [brokerInfo],
      partyBorrowerData[0].coBorrowerFName ? 2 : 1
    );
  }

  doc = doc.root().find((x) => x.node.nodeName == "DEAL", true, true);
  doc = relationships(
    doc,
    borrowerAssets,
    [...contingentLiabilityData, ...creditorInfoData],
    hasCoborrower
  );
  removeEmptyNodes(doc);
  let xml = doc.end({
    prettyPrint: true,
    allowEmptyTags: true,
    newline: "\r\n",
    indent: "\t",
  });
  return xml;
}

function assets(doc, data) {
  return buildMismoNodes(doc, data, "ASSETS", "ASSET", 0, [
    {
      path: ["ASSET_DETAIL"],
      nodes: [
        { AssetAccountIdentifier: (row) => row.accountNumber },
        { AssetCashOrMarketValueAmount: (row) => money(row.balance) },
        { AssetType: (row) => mapValue(row.accType, assetTypeDiagram) },
      ],
    },
    {
      path: ["ASSET_HOLDER", "NAME"],
      nodes: [{ FullName: (row) => row.nameAddrOfBank }],
    },
  ]);
}

function realEstateOwned(doc, data, startIndex) {
  return buildMismoNodes(doc, data, "ASSETS", "ASSET", startIndex, [
    {
      path: ["ASSET_DETAIL"],
      nodes: [{ AssetType: (row) => "" }],
    },
    {
      path: ["OWNED_PROPERTY", "OWNED_PROPERTY_DETAIL"],
      goBack: 1,
      nodes: [
        {
          OwnedPropertySubjectIndicator: (row) =>
            row.schedulePropAddr == loan["LMRInfo"].propertyAddress
              ? "true"
              : "false",
        },
        {
          OwnedPropertyDispositionStatusType: (row) =>
            mapValue(row.scheduleStatus, scheduleStatusDiagram),
        },
        {
          OwnedPropertyMaintenanceExpenseAmount: (row) =>
            money(row.insMaintTaxMisc),
        },
        {
          OwnedPropertyRentalIncomeGrossAmount: (row) =>
            money(row.grossRentalIncome),
        },
        {
          OwnedPropertyRentalIncomeNetAmount: (row) =>
            money(row.netRentalIncome),
        },
        { OwnedPropertyLienUPBAmount: (row) => money(row.unpaidBalance) },
      ],
    },
    {
      path: ["PROPERTY", "ADDRESS"],
      goBack: 1,
      nodes: [
        { AddressLineText: (row) => row.schedulePropAddr },
        { CityName: (row) => row.schedulePropCity },
        { StateCode: (row) => row.schedulePropState },
        { PostalCode: (row) => row.schedulePropZip },
      ],
    },
    {
      path: ["PROPERTY_DETAIL"],
      goBack: 1,
      nodes: [
        {
          PropertyEstimatedValueAmount: (row) => money(row.presentMarketValue),
        },
        {
          PropertyUsageType: (row) =>
            mapValue(row.intendedOccupancy, intendedOccupancyDiagram),
        },
        {
          PropertyCurrentUsageType: (row) =>
            mapValue(row.intendedOccupancy, intendedOccupancyDiagram),
        },
      ],
    },
    {
      path: [
        "PROPERTY_VALUATIONS",
        "PROPERTY_VALUATION",
        "PROPERTY_VALUATION_DETAIL",
      ],
      nodes: [
        {
          PropertyValuationAmount: (row) => money(row.presentMarketValue),
        },
      ],
    },
  ]);
}
function collaterals(doc, data) {
  return buildMismoNodes(doc, data, "COLLATERALS", "COLLATERAL", 0, [
    {
      path: ["SUBJECT_PROPERTY", "ADDRESS"],
      goBack: 1,
      nodes: [
        { AddressLineText: (row) => row.propertyAddress },
        {
          CityName: (row) => row.propertyCity,
        },
        {
          StateCode: (row) => row.propertyState,
        },
        {
          PostalCode: (row) => row.propertyZip,
        },
        { CountyName: (row) => row.propertyCounty },
        { CountryCode: (row) => "US" },
      ],
    },
    {
      path: ["PROPERTY_DETAIL"],
      nodes: [
        { PUDIndicator: (row) => "" },
        {
          PropertyStructureBuiltYear: (row) => loan["FileProInfo"][0].yearBuilt,
        },
        { PropertyEstimatedValueAmount: (row) => money(row.homeValue) },
        {
          CommunityPropertyStateIndicator: (row) => "",
        },
        {
          PropertyExistingCleanEnergyLienIndicator: (row) => "",
        },
        {
          PropertyMixedUsageIndicator: (row) =>
            row.propertyType === "Apartment Complex" ||
            row.propertyType === "Assisted Living Facility" ||
            row.propertyType === "Commercial Lot/Land"
              ? "true"
              : "false",
        },
        { FinancedUnitCount: (row) => "1", required: true },
        { PropertyInProjectIndicator: (row) => "" },
        { PropertyEstateType: (row) => "" },
        { PropertyUsageType: (row) => "" },
        { AttachmentType: (row) => "" },
        { ConstructionMethodType: (row) => "" },
        { RentalEstimatedNetMonthlyRentAmount: (row) => "" },
      ],
    },
    {
      path: [
        "PROPERTY_VALUATIONS",
        "PROPERTY_VALUATION",
        "PROPERTY_VALUATION_DETAIL",
      ],
      nodes: [
        {
          PropertyValuationAmount: (row) =>
            money(loan["listingRealtorInfo"].zillowValue),
        },
      ],
    },
    {
      path: ["SALES_CONTRACTS", "SALES_CONTRACT", "SALES_CONTRACT_DETAIL"],
      nodes: [
        {
          SalesContractAmount: (row) =>
            money(loan["listingRealtorInfo"].zillowValue),
        },
      ],
    },
  ]);
}
function contingentLiabilities(doc, data, startIndex) {
  return buildMismoNodes(doc, data, "LIABILITIES", "LIABILITY", startIndex, [
    {
      path: ["LIABILITY_DETAIL"],
      nodes: [
        {
          LiabilityType: (row) =>
            mapValue(row.typeOfLiability, contingentLiabilityDiagram),
        },
        {
          LiabilityTypeOtherDescription: (row) => row.clDescription,
        },
        {
          LiabilityAccountIdentifier: (row) => row.clAccount,
        },
        {
          LiabilityUnpaidBalanceAmount: (row) => money(row.clBalance),
        },
        {
          LiabilityPayoffStatusIndicator: (row) => "",
        },
        { LiabilityMonthlyPaymentAmount: (row) => money(row.monthlyPayment) },
        {
          LiabilityRemainingTermMonthsCount: (row) => row.monthsLeftToPay,
        },
        { LiabilityExclusionIndicator: (row) => "" },
      ],
    },
    {
      path: ["LIABILITY_HOLDER", "NAME"],
      nodes: [{ FullName: (row) => row.nameOfCompany }],
    },
  ]);
}
function liabilities(doc, data, startIndex) {
  return buildMismoNodes(doc, data, "LIABILITIES", "LIABILITY", startIndex, [
    {
      path: ["LIABILITY_DETAIL"],
      nodes: [
        {
          LiabilityType: (row) => mapValue(row.creditorType, creditTypeDiagram),
        },
        {
          LiabilityTypeOtherDescription: (row) =>
            mapValue(row.creditorType, liabilityOtherDescriptionDiagram),
        },
        {
          LiabilityAccountIdentifier: (row) => row.creditorAcctNumber,
        },
        {
          LiabilityUnpaidBalanceAmount: (row) => money(row.creditorAcctBalance),
        },
        {
          LiabilityPayoffStatusIndicator: (row) =>
            indicator(row.payAtBeforeClosing),
        },
        {
          LiabilityMonthlyPaymentAmount: (row) => money(row.creditorMinPayment),
        },
        {
          LiabilityRemainingTermMonthsCount: (row) => "",
        },
        { LiabilityExclusionIndicator: (row) => "" },
      ],
    },
    {
      path: ["LIABILITY_HOLDER", "NAME"],
      nodes: [{ FullName: (row) => row.creditorName }],
    },
  ]);
}
function loans(doc, data, startIndex) {
  return buildMismoNodes(doc, data, "LOANS", "LOAN", startIndex, [
    {
      path: ["AMORTIZATION", "AMORTIZATION_RULE"],
      nodes: [
        {
          AmortizationType: (row) => loan["fileHMLONewLoanInfo"].amortizationType,
        },
        {
          LoanAmortizationPeriodCount: (row) => streetNumber(loan["fileHMLOPropertyInfo"].loanTerm),
        },
        {
          LoanAmortizationPeriodType: (row) => loan["fileHMLOPropertyInfo"]?.loanTerm?.toLowerCase()?.includes("month") ? "Month" : "",
        },
      ],
    },
    {
      path: [
        "CLOSING_INFORMATION",
        "CLOSING_ADJUSTMENT_ITEMS",
        "CLOSING_ADJUSTMENT_ITEM",
        "CLOSING_ADJUSTMENT_ITEM_DETAIL",
      ],
      goBack: 3,
      nodes: [
        {
          ClosingAdjustmentItemAmount: (row) => "",
        },
        {
          ClosingAdjustmentItemType: (row) => "",
        },
      ],
    },
    {
      path: ["CLOSING_INFORMATION_DETAIL"],
      goBack: 2,
      nodes: [
        {
          CashFromBorrowerAtClosingAmount: (row) => "",
        },
      ],
    },
    {
      path: ["CONSTRUCTION"],
      nodes: [],
    },
    {
      path: [
        "DOCUMENT_SPECIFIC_DATA_SETS",
        "DOCUMENT_SPECIFIC_DATA_SET",
        "URLA",
        "URLA_DETAIL",
      ],
      goBack: "URLA",
      nodes: [
        {
          AlterationsImprovementsAndRepairsAmount: (row) => "",
        },
        {
          ApplicationSignedByLoanOriginatorDate: (row) => "",
        },
        {
          EstimatedClosingCostsAmount: (row) =>
            money(loan["fileLOPropInfo"].estimatedClosingCosts),
        },
        {
          MIAndFundingFeeFinancedAmount: (row) => "",
        },
        {
          MIAndFundingFeeTotalAmount: (row) => "",
        },
        {
          PrepaidItemsEstimatedAmount: (row) => "",
        },
        {
          RefinanceIncludingDebtsToBePaidOffAmount: (row) => "",
        },
      ],
    },
    {
      path: ["URLA_TOTAL", "EXTENSION", "OTHER", "ULAD:URLA_TOTAL_EXTENSION"],
      goBack: "LOAN",
      nodes: [
        {
          "ULAD:URLATotalSellerCreditsAmount": (row) => "",
        },
      ],
    },
    {
      path: ["HOUSING_EXPENSES", "HOUSING_EXPENSE"],
      goBack: 1,
      nodes: [
        { HousingExpensePaymentAmount: (row) => "" },
        { HousingExpenseTimingType: (row) => "" },
        {
          HousingExpenseType: (row) => "",
        },
      ],
    },
    {
      path: ["HOUSING_EXPENSE"],
      goBack: "LOAN",
      nodes: [
        { HousingExpensePaymentAmount: (row) => "" },
        { HousingExpenseTimingType: (row) => "" },
        { HousingExpenseType: (row) => "" },
      ],
    },
    {
      path: ["LOAN_DETAIL"],
      nodes: [
        { BalloonIndicator: (row) => "" },
        {
          BorrowerCount: (row) =>
            loan["LMRInfo"].isCoBorrower == "1" ? "2" : "1",
        },
        { TotalMortgagedPropertiesCount: (row) => "" },
        { ApplicationReceivedDate: (row) => "" },
        {
          BuydownTemporarySubsidyFundingIndicator: (row) => "",
        },
        { ConstructionLoanIndicator: (row) => "" },
        {
          ConversionOfContractForDeedIndicator: (row) => "",
        },
        {
          EnergyRelatedImprovementsIndicator: (row) => "",
        },
        { InterestOnlyIndicator: (row) => "" },
        { NegativeAmortizationIndicator: (row) => "" },
        { PrepaymentPenaltyIndicator: (row) => "" },
      ],
    },
    {
      path: ["LOAN_IDENTIFIERS", "LOAN_IDENTIFIER"],
      nodes: [
        { LoanIdentifier: (row) => row.LMRId },
        {
          LoanIdentifierType: (row) => "LenderLoan",
        },
      ],
    },
    {
      path: ["LOAN_PRODUCT", "LOAN_PRODUCT_DETAIL"],
      nodes: [
        { DiscountPointsTotalAmount: (row) => "" },
        {
          ProductDescription: (row) => "",
        },
      ],
    },
    {
      path: ["LOAN_STATUSES", "LOAN_STATUS"],
      nodes: [{ LoanStatusIdentifier: (row) => "" }],
    },
    {
      path: ["ORIGINATION_SYSTEMS", "ORIGINATION_SYSTEM"],
      nodes: [
        {
          LoanOriginationSystemVendorIdentifier: (row) => "",
        },
        {
          LoanOriginationSystemName: (row) => "",
        },
        {
          LoanOriginationSystemVersionIdentifier: (row) => "",
        },
      ],
    },
    {
      path: ["PURCHASE_CREDITS"],
      nodes: [],
    },
    {
      path: ["QUALIFICATION"],
      nodes: [],
    },
    {
      path: ["REFINANCE"],
      nodes: [
        {
          RefinanceCashOutDeterminationType: (row) =>
            mapValue(
              loan["fileHMLONewLoanInfo"].typeOfHMLOLoanRequesting,
              loanTypeDiagram
            ) == "Refinance"
              ? "Unknown"
              : "",
          // loan["fileHMLOPropertyInfo"].typeOfHMLOLoanRequesting
        },
        {
          RefinancePrimaryPurposeType: (row) => "",
        },
      ],
    },
    {
      path: ["TERMS_OF_LOAN"],
      nodes: [
        {
          BaseLoanAmount: (row) =>
            Math.abs(money(loan["ResponseInfo"].totalLoanAmount)),
        },
        {
          LoanPurposeType: (row) =>
            mapValue(
              loan["fileHMLONewLoanInfo"].typeOfHMLOLoanRequesting,
              loanTypeDiagram
            ),
        },
        {
          MortgageType: (row) => "",
        },
        {
          LienPriorityType: (row) => loan["fileHMLOPropertyInfo"].lienPosition === 1 ? 'FirstLien' : 'SecondLien',
        },
        { NoteRatePercent: (row) => money(loan["LMRInfo"].lien1Rate) },
      ],
    },
  ]);
}
function partyBorrower(doc, data) {
  return buildMismoNodes(doc, data, "PARTIES", "PARTY", 0, [
    {
      path: [
        "INDIVIDUAL",
        "CONTACT_POINTS",
        "CONTACT_POINT",
        "CONTACT_POINT_EMAIL",
      ],
      goBack: 2,
      nodes: [
        {
          ContactPointEmailValue: (row) => row.borrowerEmail,
        },
      ],
    },
    {
      path: ["CONTACT_POINT", "CONTACT_POINT_TELEPHONE"],
      goBack: 1,
      nodes: [
        {
          ContactPointTelephoneValue: (row) => tel(row.cellNumber),
        },
      ],
    },
    {
      path: ["CONTACT_POINT_DETAIL"],
      goBack: 2,
      nodes: [
        { ContactPointRoleType: (row) => tel(row.cellNumber) && "Mobile" },
      ],
    },
    {
      path: ["CONTACT_POINT", "CONTACT_POINT_TELEPHONE"],
      goBack: 1,
      nodes: [
        {
          ContactPointTelephoneValue: (row) => tel(row.workNumber),
        },
      ],
    },
    {
      path: ["CONTACT_POINT_DETAIL"],
      goBack: 2,
      nodes: [{ ContactPointRoleType: (row) => tel(row.workNumber) && "Work" }],
    },
    {
      path: ["CONTACT_POINT", "CONTACT_POINT_TELEPHONE"],
      goBack: 1,
      nodes: [{ ContactPointTelephoneValue: (row) => tel(row.phoneNumber) }],
    },
    {
      path: ["CONTACT_POINT_DETAIL"],
      goBack: 3,
      nodes: [
        { ContactPointRoleType: (row) => tel(row.phoneNumber) && "Home" },
      ],
    },
    {
      path: ["NAME"],
      goBack: 2,
      nodes: [
        { FirstName: (row) => row.borrowerFName },
        { LastName: (row) => row.borrowerLName },
      ],
    },
    // {
    //   path: ["ADDRESSES", "ADDRESS"],
    //   goBack: 1,
    //   nodes: [
    //     {
    //       AddressType: (row) =>
    //         streetName(loan.file2Info.presentAddress) && "Current",
    //     },
    //     {
    //       StreetName: (row) => streetName(loan.file2Info.presentAddress),
    //     },
    //     {
    //       StreetPrimaryNumberText: (row) =>
    //         streetNumber(loan.file2Info.presentAddress),
    //     },
    //     { CityName: (row) => loan.file2Info.presentCity },
    //     { StateCode: (row) => loan.file2Info.presentState },
    //     { PostalCode: (row) => row.presentZip },
    //     {
    //       CountryCode: (row) =>
    //         streetName(loan.file2Info.presentAddress) && "US",
    //     },
    //   ],
    // },
    // {
    //   path: ["ADDRESS"],
    //   goBack: 1,
    //   nodes: [
    //     { AddressType: (row) => streetName(row.previousAddress) && "Prior" },
    //     {
    //       StreetName: (row) => streetName(row.previousAddress),
    //     },
    //     {
    //       StreetPrimaryNumberText: (row) => streetNumber(row.previousAddress),
    //     },
    //     { CityName: (row) => row.previousCity },
    //     { StateCode: (row) => row.previousState },
    //     { PostalCode: (row) => row.previousZip },
    //     { CountryCode: (row) => streetName(row.previousAddress) && "US" },
    //   ],
    // },
    // {
    //   path: ["ADDRESS"],
    //   goBack: 2,
    //   nodes: [
    //     { AddressType: (row) => streetName(row.mailingAddress) && "Mailing" },
    //     {
    //       StreetName: (row) => streetName(row.mailingAddress),
    //     },
    //     {
    //       StreetPrimaryNumberText: (row) => streetNumber(row.mailingAddress),
    //     },
    //     { AddressUnitIdentifier: (row) => "" },
    //     { CityName: (row) => row.mailingCity },
    //     { StateCode: (row) => row.mailingState },
    //     { PostalCode: (row) => row.mailingZip },
    //     { CountryCode: (row) => streetName(row.mailingAddress) && "US" },
    //   ],
    // },
    {
      path: [
        "ROLES",
        {
          name: "ROLE",
          attributes: { SequenceNumber: 1, "xlink:label": "BORROWER_1" },
        },
        "BORROWER",
        "BORROWER_DETAIL",
      ],
      goBack: 1,
      nodes: [
        {
          BorrowerBirthDate: (row) => validDate(row.borrowerDOB),
        },
        {
          BorrowerTotalMortgagedPropertiesCount: (row) => "",
        },
        {
          CommunityPropertyStateResidentIndicator: (row) => "",
        },
        {
          DomesticRelationshipIndicator: (row) => "",
        },
        {
          JointAssetLiabilityReportingType: (row) => "",
        },
        {
          DependentCount: (row) =>
            loan.fileHMLOInfo.agesOfDependent
              ? loan.fileHMLOInfo.agesOfDependent.split(",").length
              : "0",
        },
        {
          MaritalStatusType: (row) =>
            mapValue(row.maritalStatus, maritalStatusDiagram),
        },
      ],
    },
    {
      path: [
        "CURRENT_INCOME",
        "CURRENT_INCOME_ITEMS",
        {
          name: "CURRENT_INCOME_ITEM",
          attributes: {
            SequenceNumber: 1,
            "xlink:label": "CURRENT_INCOME_ITEM_1",
          },
        },
        "CURRENT_INCOME_ITEM_DETAIL",
      ],
      goBack: 2,
      nodes: [
        {
          CurrentIncomeMonthlyTotalAmount: (row) =>
            loan["incomeInfo"].grossIncome1 &&
            money(
              Math.floor(
                parseInt(loan["incomeInfo"].grossIncome1.replace(/,/g, "")) / 12
              )
            ),
        },
        { EmploymentIncomeIndicator: (row) => "true" },
        { IncomeType: (row) => loan["incomeInfo"].grossIncome1 && "Base" },
      ],
    },
    {
      path: ["CURRENT_INCOME_ITEM", "CURRENT_INCOME_ITEM_DETAIL"],
      goBack: 2,
      nodes: [
        {
          CurrentIncomeMonthlyTotalAmount: (row) =>
            loan["incomeInfo"].commissionOrBonus1 &&
            money(
              Math.floor(
                parseInt(
                  loan["incomeInfo"].commissionOrBonus1.replace(/,/g, "")
                ) / 12
              )
            ),
        },
        {
          EmploymentIncomeIndicator: (row) =>
            loan["incomeInfo"].commissionOrBonus1 && "true",
        },
        {
          IncomeType: (row) => loan["incomeInfo"].commissionOrBonus1 && "Bonus",
        },
      ],
    },
    {
      path: ["CURRENT_INCOME_ITEM", "CURRENT_INCOME_ITEM_DETAIL"],
      goBack: 2,
      nodes: [
        {
          CurrentIncomeMonthlyTotalAmount: (row) =>
            loan["incomeInfo"].otherHouseHold1 &&
            Math.floor(
              parseInt(loan["incomeInfo"].otherHouseHold1.replace(/,/g, "")) /
                12
            ),
        },
        {
          EmploymentIncomeIndicator: (row) =>
            loan["incomeInfo"].otherHouseHold1 && "true",
        },
        { IncomeType: (row) => loan["incomeInfo"].otherHouseHold1 && "Other" },
      ],
    },
    {
      path: ["CURRENT_INCOME_ITEM", "CURRENT_INCOME_ITEM_DETAIL"],
      goBack: 4,
      nodes: [
        {
          CurrentIncomeMonthlyTotalAmount: (row) =>
            loan["incomeInfo"].overtime1 &&
            money(
              Math.floor(
                parseInt(loan["incomeInfo"].overtime1.replace(/,/g, "")) / 12
              )
            ),
        },
        {
          EmploymentIncomeIndicator: (row) =>
            loan["incomeInfo"].overtime1 && "true",
        },
        { IncomeType: (row) => loan["incomeInfo"].overtime1 && "Overtime" },
      ],
    },
    {
      path: ["DECLARATION", "DECLARATION_DETAIL"],
      goBack: "DECLARATION_DETAIL",
      nodes: [
        {
          CitizenshipResidencyType: (row) =>
            mapValue(
              loan["fileHMLOInfo"].borrowerCitizenship,
              citizenshipDiagram
            ),
        },
        {
          IntentToOccupyType: (row) =>
            loan["fileHMLOBackGroundInfo"].isBorIntendToOccupyPropAsPRI
              ? "Yes"
              : "No",
        },
        { HomeownerPastThreeYearsType: (row) => "" },
        { PriorPropertyUsageType: (row) => "" },
        { FHASecondaryResidenceIndicator: (row) => "" },
        { PriorPropertyTitleType: (row) => "" },
        {
          UndisclosedBorrowedFundsIndicator: (row) => "",
        },
        { UndisclosedBorrowedFundsAmount: (row) => "" },
        {
          UndisclosedMortgageApplicationIndicator: (row) => "",
        },
        {
          UndisclosedCreditApplicationIndicator: (row) => "",
        },
        {
          PropertyProposedCleanEnergyLienIndicator: (row) => "",
        },
        {
          UndisclosedComakerOfNoteIndicator: (row) => "",
        },
        {
          OutstandingJudgmentsIndicator: (row) =>
            indicator(
              loan["fileHMLOBackGroundInfo"].isAnyBorOutstandingJudgements
            ),
        },
        {
          PresentlyDelinquentIndicator: (row) =>
            indicator(loan["fileHMLOBackGroundInfo"].isBorPresenltyDelinquent),
        },
        {
          PartyToLawsuitIndicator: (row) =>
            indicator(loan["fileHMLOBackGroundInfo"].hasBorAnyActiveLawsuits),
        },
        {
          PriorPropertyDeedInLieuConveyedIndicator: (row) => "",
        },
        {
          PriorPropertyShortSaleCompletedIndicator: (row) => "",
        },
        {
          PriorPropertyForeclosureCompletedIndicator: (row) => "",
        },
        {
          BankruptcyIndicator: (row) =>
            indicator(
              loan["fileHMLOBackGroundInfo"].isBorDecalredBankruptPastYears
            ),
        },
      ],
    },
    {
      path: ["EXTENSION", "OTHER", "ULAD:DECLARATION_DETAIL_EXTENSION"],
      goBack: 4,
      nodes: [
        {
          "ULAD:SpecialBorrowerSellerRelationshipIndicator": (row) => "false",
        },
      ],
    },
    {
      path: ["DECLARATION_EXPLANATIONS"],
      goBack: 2,
      nodes: [],
    },
    {
      path: [
        "EMPLOYERS",
        {
          name: "EMPLOYER",
          attributes: { SequenceNumber: 1, "xlink:label": "EMPLOYER_1" },
        },
        "ADDRESS",
      ],
      goBack: 1,
      nodes: [],
    },
    {
      path: [
        "LEGAL_ENTITY",
        "CONTACTS",
        "CONTACT",
        "CONTACT_POINTS",
        "CONTACT_POINT",
        "CONTACT_POINT_TELEPHONE",
      ],
      goBack: 1,
      nodes: [{ ContactPointTelephoneValue: (row) => "" }],
    },
    {
      path: ["CONTACT_POINT_DETAIL"],
      goBack: 5,
      nodes: [{ ContactPointRoleType: (row) => "" }],
    },
    {
      path: ["LEGAL_ENTITY_DETAIL"],
      goBack: 2,
      nodes: [{ FullName: (row) => "" }],
    },
    {
      path: ["ADDRESS"],
      nodes: [
        { AddressLineText: (row) => "" },
        { CityName: (row) => "" },
        { PostalCode: (row) => "" },
        { StateCode: (row) => "" },
      ],
    },
    {
      path: ["EMPLOYMENT"],
      goBack: 3,
      nodes: [
        {
          EmploymentStatusType: (row) => "Current",
        },
        {
          EmploymentClassificationType: (row) =>
            mapValue(
              loan["incomeInfo"].employedInfo1,
              employmentClassificationType
            ),
        },
        {
          EmploymentPositionDescription: (row) =>
            loan["incomeInfo"].occupation1,
        },
        {
          EmploymentStartDate: (row) =>
            validDate(loan["incomeInfo"].borrowerHireDate)
        },
        {
          EmploymentTimeInLineOfWorkMonthsCount: (row) =>
            loan["incomeInfo"].yearsAtJob1 * 12,
        },
        {
          EmploymentBorrowerSelfEmployedIndicator: (row) =>
            loan["incomeInfo"].employedInfo1 === "Self-Employed"
              ? "true"
              : "false",
        },
        {
          OwnershipInterestType: (row) =>
            mapValue(
              loan["incomeInfo"].emptypeshare1,
              ownershipInterestDiagram
            ),
        },
        {
          EmploymentMonthlyIncomeAmount: (row) =>
            loan["incomeInfo"].empmonthlyincome1,
        },
        {
          SpecialBorrowerEmployerRelationshipIndicator: (row) => "false",
        },
      ],
    },
    {
      path: ["GOVERNMENT_MONITORING", "GOVERNMENT_MONITORING_DETAIL"],
      goBack: "GOVERNMENT_MONITORING_DETAIL",
      nodes: [
        {
          HMDAEthnicityRefusalIndicator: (row) => "",
        },
        {
          HMDAGenderRefusalIndicator: (row) => "",
        },
        {
          HMDARaceRefusalIndicator: (row) => "",
        },
      ],
    },
    {
      path: [
        "EXTENSION",
        "OTHER",
        "ULAD:GOVERNMENT_MONITORING_DETAIL_EXTENSION",
      ],
      goBack: "GOVERNMENT_MONITORING",
      nodes: [
        {
          "ULAD:HMDAGenderType": (row) =>
            mapValue(loan["QAInfo"].BGender, genderDiagram),
        },
        {
          "ULAD:ApplicationTakenMethodType": (row) => "",
        },
      ],
    },
    {
      path: ["HMDA_ETHNICITY_ORIGINS", "HMDA_ETHNICITY_ORIGIN"],
      goBack: 2,
      nodes: [
        {
          HMDAEthnicityOriginType: (row) => "",
        },
        {
          HMDAEthnicityOriginTypeOtherDescription: (row) => "",
        },
      ],
    },
    {
      path: ["HMDA_RACES", "HMDA_RACE", "HMDA_RACE_DETAIL"],
      goBack: "GOVERNMENT_MONITORING",
      nodes: [
        {
          HMDARaceType: (row) => "",
        },
      ],
    },
    {
      path: [
        "EXTENSION",
        "OTHER",
        "ULAD:GOVERNMENT_MONITORING_EXTENSION",
        "ULAD:HMDA_ETHNICITIES",
        "ULAD:HMDA_ETHNICITY",
      ],
      goBack: "BORROWER",
      nodes: [{ "ULAD:HMDAEthnicityType": (row) => "" }],
    },
    {
      path: ["RESIDENCES", "RESIDENCE", "ADDRESS"],
      goBack: "RESIDENCE",
      nodes: [
        {
          AddressLineText: (row) => loan["clientInfo"].clientAddress
        },
        { CityName: (row) => loan["clientInfo"].clientCity },
        { PostalCode: (row) => loan["clientInfo"].clientZip },
        { StateCode: (row) => loan["clientInfo"].clientState },
      ],
    },
    {
      path: ["LANDLORD", "LANDLORD_DETAIL"],
      goBack: "RESIDENCE",
      nodes: [{ MonthlyRentAmount: (row) => "" }],
    },
    {
      path: ["RESIDENCE_DETAIL"],
      goBack: "ROLE",
      nodes: [
        {
          BorrowerResidencyBasisType: (row) =>
            loan["file2Info"].borPresentPropType
              ? loan["file2Info"].borPresentPropType
              : "Unknown",
        },
        {
          BorrowerResidencyDurationMonthsCount: (row) => "",
        },
        {
          BorrowerResidencyType: (row) =>
            loan["FileProInfo"].isHouseProperty ? "Current" : "Prior",
        },
      ],
    },
    {
      path: ["ROLE_DETAIL"],
      goBack: 3,
      nodes: [{ PartyRoleType: (row) => "Borrower" }],
    },
    {
      path: ["TAXPAYER_IDENTIFIERS", "TAXPAYER_IDENTIFIER"],
      nodes: [
        { TaxpayerIdentifierType: (row) => "SocialSecurityNumber" },
        {
          TaxpayerIdentifierValue: (row) => row.ssnNumber,
        },
      ],
    },
  ]);
}
function partyCoBorrower(doc, data) {
  return buildMismoNodes(doc, data, "PARTIES", "PARTY", 1, [
    {
      path: ["INDIVIDUAL", "ALIASES", "ALIAS", "NAME"],
      goBack: 3,
      nodes: [
        { FirstName: (row) => "" },
        {
          LastName: (row) => "",
        },
      ],
    },
    {
      path: ["CONTACT_POINTS", "CONTACT_POINT", "CONTACT_POINT_EMAIL"],
      goBack: 2,
      nodes: [{ ContactPointEmailValue: (row) => row.coBorrowerEmail }],
    },
    {
      path: ["CONTACT_POINT", "CONTACT_POINT_TELEPHONE"],
      goBack: 1,
      nodes: [
        {
          ContactPointTelephoneValue: (row) => tel(row.coBPhoneNumber),
        },
      ],
    },
    {
      path: ["CONTACT_POINT_DETAIL"],
      goBack: 2,
      nodes: [{ ContactPointRoleType: (row) => "Home" }],
    },
    {
      path: ["CONTACT_POINT", "CONTACT_POINT_TELEPHONE"],
      goBack: 1,
      nodes: [
        {
          ContactPointTelephoneValue: (row) => tel(row.coBCellNumber),
        },
      ],
    },
    {
      path: ["CONTACT_POINT_DETAIL"],
      goBack: 2,
      nodes: [{ ContactPointRoleType: (row) => "Mobile" }],
    },
    {
      path: ["CONTACT_POINT", "CONTACT_POINT_TELEPHONE"],
      goBack: 1,
      nodes: [
        {
          ContactPointTelephoneValue: (row) => tel(row.coBFax),
        },
      ],
    },
    {
      path: ["CONTACT_POINT_DETAIL"],
      goBack: 3,
      nodes: [{ ContactPointRoleType: (row) => "Work" }],
    },
    {
      path: ["NAME"],
      goBack: 2,
      nodes: [
        { FirstName: (row) => row.coBorrowerFName },
        { LastName: (row) => row.coBorrowerLName },
      ],
    },
    // {
    //   path: ["ADDRESSES", "ADDRESS"],
    //   goBack: 1,
    //   nodes: [
    //     { AddressType: (row) => "Current" },
    //     {
    //       StreetName: (row) => streetName(loan.file2Info.coBPresentAddress),
    //     },
    //     {
    //       StreetPrimaryNumberText: (row) =>
    //         streetNumber(loan.file2Info.coBPresentAddress),
    //     },
    //     { CityName: (row) => loan.file2Info.coBPresentCity },
    //     { StateCode: (row) => loan.file2Info.coBPresentState },
    //     { PostalCode: (row) => row.coBPresentZip },
    //     { CountryCode: (row) => "US" },
    //   ],
    // },
    // {
    //   path: ["ADDRESS"],
    //   goBack: 1,
    //   nodes: [
    //     { AddressType: (row) => "Prior" },
    //     {
    //       StreetName: (row) => streetName(row.coBorPreviousAddress),
    //     },
    //     {
    //       StreetPrimaryNumberText: (row) =>
    //         streetNumber(row.coBorPreviousAddress),
    //     },
    //     { CityName: (row) => row.coBorPreviousCity },
    //     { StateCode: (row) => row.coBorPreviousState },
    //     { PostalCode: (row) => row.coBorPreviousZip },
    //     { CountryCode: (row) => "US" },
    //   ],
    // },
    // {
    //   path: ["ADDRESS"],
    //   goBack: 2,
    //   nodes: [
    //     { AddressType: (row) => "Mailing" },
    //     {
    //       StreetName: (row) => streetName(row.coBorrowerMailingAddress),
    //     },
    //     {
    //       StreetPrimaryNumberText: (row) =>
    //         streetNumber(row.coBorrowerMailingAddress),
    //     },
    //     { AddressUnitIdentifier: (row) => "" },
    //     { CityName: (row) => row.coBorrowerMailingCity },
    //     { StateCode: (row) => row.coBorrowerMailingState },
    //     { PostalCode: (row) => row.coBorrowerMailingZip },
    //     { CountryCode: (row) => "US" },
    //   ],
    // },
    {
      path: [
        "ROLES",
        {
          name: "ROLE",
          attributes: { SequenceNumber: 1, "xlink:label": "BORROWER_2" },
        },
        "BORROWER",
        "BORROWER_DETAIL",
      ],
      goBack: 1,
      nodes: [
        {
          BorrowerBirthDate: (row) => validDate(row.coBorrowerDOB),
        },
        {
          BorrowerTotalMortgagedPropertiesCount: (row) => "",
        },
        {
          CommunityPropertyStateResidentIndicator: (row) => "",
        },
        {
          DomesticRelationshipIndicator: (row) => "",
        },
        {
          JointAssetLiabilityReportingType: (row) => "",
        },
        {
          DependentCount: (row) =>
            loan["file2Info"].coBNoOfDependent
              ? loan["file2Info"].coBNoOfDependent
              : "0",
        },
        {
          MaritalStatusType: (row) =>
            mapValue(row.maritalStatusCoBor, maritalStatusDiagram),
        },
      ],
    },
    {
      path: ["CURRENT_INCOME", "CURRENT_INCOME_DETAIL"],
      goBack: 1,
      nodes: [
        {
          URLABorrowerTotalOtherIncomeAmount: (row) => "",
        },
      ],
    },
    {
      path: [
        "CURRENT_INCOME_ITEMS",
        {
          name: "CURRENT_INCOME_ITEM",
          attributes: {
            SequenceNumber: 1,
            "xlink:label": "CURRENT_INCOME_ITEM_2",
          },
        },
        "CURRENT_INCOME_ITEM_DETAIL",
      ],
      goBack: 2,
      nodes: [
        {
          CurrentIncomeMonthlyTotalAmount: (row) =>
            loan["incomeInfo"].grossIncome2 &&
            money(
              Math.floor(
                parseInt(loan["incomeInfo"].grossIncome2.replace(/,/g, "")) / 12
              )
            ),
        },
        { EmploymentIncomeIndicator: (row) => "true" },
        { IncomeType: (row) => "Base" },
      ],
    },
    {
      path: ["CURRENT_INCOME_ITEM", "CURRENT_INCOME_ITEM_DETAIL"],
      goBack: 2,
      nodes: [
        {
          CurrentIncomeMonthlyTotalAmount: (row) => "",
        },
        { EmploymentIncomeIndicator: (row) => "" },
        { IncomeType: (row) => "" },
      ],
    },
    {
      path: ["CURRENT_INCOME_ITEM", "CURRENT_INCOME_ITEM_DETAIL"],
      goBack: 2,
      nodes: [
        {
          CurrentIncomeMonthlyTotalAmount: (row) => "",
        },
        { EmploymentIncomeIndicator: (row) => "" },
        { IncomeType: (row) => "" },
      ],
    },
    {
      path: ["CURRENT_INCOME_ITEM", "CURRENT_INCOME_ITEM_DETAIL"],
      goBack: 2,
      nodes: [
        {
          CurrentIncomeMonthlyTotalAmount: (row) => "",
        },
        { EmploymentIncomeIndicator: (row) => "" },
        { IncomeType: (row) => "" },
      ],
    },
    {
      path: ["CURRENT_INCOME_ITEM", "CURRENT_INCOME_ITEM_DETAIL"],
      goBack: 4,
      nodes: [
        {
          CurrentIncomeMonthlyTotalAmount: (row) => "",
        },
        { EmploymentIncomeIndicator: (row) => "" },
        { IncomeType: (row) => "" },
      ],
    },
    {
      path: ["DECLARATION", "DECLARATION_DETAIL"],
      nodes: [
        {
          CitizenshipResidencyType: (row) =>
            mapValue(
              loan["fileHMLOInfo"].coBorrowerCitizenship,
              citizenshipDiagram
            ),
        },
        {
          IntentToOccupyType: (row) =>
            loan["fileHMLOBackGroundInfo"].isCoBorIntendToOccupyPropAsPRI
              ? "Yes"
              : "No",
        },
        { HomeownerPastThreeYearsType: (row) => "" },
        { PriorPropertyUsageType: (row) => "" },
        { FHASecondaryResidenceIndicator: (row) => "" },
        { PriorPropertyTitleType: (row) => "" },
        {
          UndisclosedBorrowedFundsIndicator: (row) => "",
        },
        { UndisclosedBorrowedFundsAmount: (row) => "" },
        {
          UndisclosedMortgageApplicationIndicator: (row) => "",
        },
        {
          UndisclosedCreditApplicationIndicator: (row) => "",
        },
        {
          PropertyProposedCleanEnergyLienIndicator: (row) => "",
        },
        {
          UndisclosedComakerOfNoteIndicator: (row) => "",
        },
        {
          OutstandingJudgmentsIndicator: (row) =>
            indicator(loan["fileHMLOBackGroundInfo"].hasCoBorAnyActiveLawsuits),
        },
        {
          PresentlyDelinquentIndicator: (row) =>
            indicator(
              loan["fileHMLOBackGroundInfo"].isCoBorPresenltyDelinquent
            ),
        },
        {
          PartyToLawsuitIndicator: (row) =>
            indicator(loan["fileHMLOBackGroundInfo"].hasCoBorAnyActiveLawsuits),
        },
        {
          PriorPropertyDeedInLieuConveyedIndicator: (row) => "",
        },
        {
          PriorPropertyShortSaleCompletedIndicator: (row) => "",
        },
        {
          PriorPropertyForeclosureCompletedIndicator: (row) => "",
        },
        {
          BankruptcyIndicator: (row) =>
            indicator(
              loan["fileHMLOBackGroundInfo"].isCoBorDecalredBankruptPastYears
            ),
        },
      ],
    },
    {
      path: [
        "EMPLOYERS",
        {
          name: "EMPLOYER",
          attributes: { SequenceNumber: 1, "xlink:label": "EMPLOYER_2" },
        },
        "LEGAL_ENTITY",
        "LEGAL_ENTITY_DETAIL",
      ],
      goBack: "EMPLOYER",
      nodes: [{ FullName: (row) => loan["incomeInfo"].employer2 }],
    },
    {
      path: ["EMPLOYMENT"],
      goBack: 3,
      nodes: [
        {
          EmploymentStatusType: (row) => "Current",
        },
        {
          EmploymentClassificationType: (row) =>
            mapValue(
              loan["incomeInfo"].employedInfo2,
              employmentClassificationType
            ),
        },
        {
          EmploymentPositionDescription: (row) =>
            loan["incomeInfo"].occupation2,
        },
        {
          EmploymentStartDate: (row) =>
            validDate(loan["incomeInfo"].coBorrowerHireDate)
        },
        {
          EmploymentTimeInLineOfWorkMonthsCount: (row) =>
            loan["incomeInfo"].yearsAtJob2 * 12,
        },
        {
          EmploymentBorrowerSelfEmployedIndicator: (row) =>
            loan["incomeInfo"].employedInfo2 === "Self-Employed"
              ? "true"
              : "false",
        },
        {
          OwnershipInterestType: (row) =>
            mapValue(
              loan["incomeInfo"].emptypeshare2,
              ownershipInterestDiagram
            ),
        },
        {
          EmploymentMonthlyIncomeAmount: (row) =>
            loan["incomeInfo"].empmonthlyincome2,
        },
      ],
    },
    {
      path: ["GOVERNMENT_MONITORING", "GOVERNMENT_MONITORING_DETAIL"],
      goBack: "GOVERNMENT_MONITORING_DETAIL",
      nodes: [
        {
          HMDAEthnicityOriginType: (row) => "",
        },
        {
          HMDAEthnicityOriginTypeOtherDescription: (row) => "",
        },
        {
          HMDAEthnicityCollectedBasedOnVisualObservationOrSurnameIndicator: (
            row
          ) => "",
        },
        { HMDAEthnicityRefusalIndicator: (row) => "" },
        {
          HMDAGenderCollectedBasedOnVisualObservationOrNameIndicator: (row) =>
            "",
        },
        { HMDAGenderRefusalIndicator: (row) => "" },
        {
          HMDARaceCollectedBasedOnVisualObservationOrSurnameIndicator: (row) =>
            "",
        },
        { HMDARaceRefusalIndicator: (row) => "" },
      ],
    },
    {
      path: [
        "EXTENSION",
        "OTHER",
        "ULAD:GOVERNMENT_MONITORING_DETAIL_EXTENSION",
      ],
      goBack: "GOVERNMENT_MONITORING",
      nodes: [
        {
          "ULAD:ApplicationTakenMethodType": (row) => "",
        },
        {
          "ULAD:HMDAGenderType": (row) =>
            mapValue(loan["QAInfo"].CBGender, genderDiagram),
        },
      ],
    },
    {
      path: [
        "HMDA_RACES",
        "HMDA_RACE",
        "HMDA_RACE_DESIGNATIONS",
        "HMDA_RACE_DESIGNATION",
        "EXTENSION",
        "OTHER",
        "ULAD:HMDA_RACE_DESIGNATION_EXTENSION",
      ],
      goBack: "HMDA_RACE",
      nodes: [
        {
          "ULAD:HMDARaceDesignationOtherPacificIslanderDescription": (row) =>
            "",
        },
        {
          "ULAD:HMDARaceDesignationType": (row) => "",
        },
      ],
    },
    {
      path: ["HMDA_RACE_DETAIL"],
      goBack: "GOVERNMENT_MONITORING",
      nodes: [{ HMDARaceType: (row) => "" }],
    },
    {
      path: [
        "EXTENSION",
        "OTHER",
        "ULAD:GOVERNMENT_MONITORING_EXTENSION",
        "ULAD:HMDA_ETHNICITIES",
        "ULAD:HMDA_ETHNICITY",
      ],
      goBack: "BORROWER",
      nodes: [{ "ULAD:HMDAEthnicityType": (row) => "" }],
    },
    {
      path: ["RESIDENCES", "RESIDENCE", "ADDRESS"],
      goBack: "RESIDENCE",
      nodes: [
        { AddressLineText: (row) => loan["file2Info"].coBPresentAddress },
        { CityName: (row) => loan["file2Info"].coBPresentCity },
        { PostalCode: (row) => loan["file2Info"].coBPresentZip },
        { StateCode: (row) => loan["file2Info"].coBPresentState },
      ],
    },
    {
      path: ["RESIDENCE_DETAIL"],
      goBack: "ROLE",
      nodes: [
        {
          BorrowerResidencyBasisType: (row) =>
            loan["file2Info"].coBPresentPropType,
        },
        {
          BorrowerResidencyDurationMonthsCount: (row) =>
            getMonthDuration(loan["file2Info"].presentPropLengthTimeCoBor),
        },
        { BorrowerResidencyType: (row) => "Current" },
      ],
    },
    {
      path: ["ROLE_DETAIL"],
      goBack: 3,
      nodes: [{ PartyRoleType: (row) => "Borrower" }],
    },
    {
      path: ["TAXPAYER_IDENTIFIERS", "TAXPAYER_IDENTIFIER"],
      nodes: [
        { TaxpayerIdentifierType: (row) => "SocialSecurityNumber" },
        {
          TaxpayerIdentifierValue: (row) => row.coBSsnNumber,
        },
      ],
    },
  ]);
}

function partyBroker(doc, data, startingIndex) {
  return buildMismoNodes(doc, data, "PARTIES", "PARTY", startingIndex, [
    {
      path: ["LEGAL_ENTITY", "LEGAL_ENTITY_DETAIL"],
      goBack: 2,
      nodes: [{ FullName: (row) => "" }],
    },
    {
      path: ["ADDRESSES", "ADDRESS"],
      nodes: [
        {
          AddressLineText: (row) => "",
        },
        { CityName: (row) => "" },
        { StateCode: (row) => "" },
        { PostalCode: (row) => "" },
      ],
    },
    {
      path: ["ROLES", "ROLE", "LICENSES", "LICENSE", "LICENSE_DETAIL"],
      goBack: 3,
      nodes: [
        {
          LicenseIdentifier: (row) => "",
        },
        {
          LicenseAuthorityLevelType: (row) => "",
        },
      ],
    },
    {
      path: ["ROLE_DETAIL"],
      nodes: [
        {
          PartyRoleType: (row) => "LoanOriginationCompany",
        },
      ],
    },
  ]);
}
function buildMismoNodes(
  doc,
  data,
  rootNode,
  repeatingNode,
  startIndex = 0,
  config
) {
  if (!doc) {
    throw new Error('Document is not defined, this is not expected!')
  }
  try {

  
  if (data && Array.isArray(data) && data.length > 0) {
    for (let counter = 0; counter < data.length; counter++) {
      const row = data[counter];
      const methodRoot = doc
        .root()
        .find((n) => n.node.nodeName === rootNode, true, true);
      if (methodRoot) {
        doc = methodRoot;
      } else {
        doc = doc
          .root()
          .find((n) => n.node.nodeName === "DEAL", true, true)
          .ele(rootNode);
      }
      let attributes = {
        SequenceNumber: counter + startIndex + 1,
        "xlink:label": `${repeatingNode}_${counter + startIndex + 1}`,
      };
      if (repeatingNode === "LOAN" && counter === 0 && startIndex === 0) {
        attributes = {
          LoanRoleType: "SubjectLoan",
          "xlink:label": `${repeatingNode}_${counter + startIndex + 1}`,
        };
      }
      doc = doc.ele(repeatingNode, attributes);
      config.forEach((element) => {
        doc = container(doc, element.path);
        element.nodes = sortNodes(element.nodes);
        element.nodes.forEach((n) => {
          const key = Object.keys(n)[0];
          let value = n[key](row, counter + 1);
          // n.hardCoded = false; //Override to set all hard coded to false to remove all hardcoding comments
          if (n.hardCoded) {
            doc
              .ele(key)
              .txt(value)
              .up()
              .com(`${key} is HARD CODED to ${value}`);
          } else {
            if (n.required && !value) {
              if (n.defaultValue) {
                doc
                  .ele(key)
                  .txt(n.defaultValue)
                  .up()
                  .com(
                    `${n.defaultValue} is a default value, no value supplied for ${key}`
                  );
              } else {
                throw new Error("Required value: " + key);
              }
            } else {
              if (value == null) {
                value = ""
              }
              doc.ele(key).txt(value).up();
            }
          }
        });
        if (element.goBack) {
          if (Number.isInteger(element.goBack)) {
            for (let i = 0; i < element.goBack; i++) {
              doc = doc.up();
            }
          } else {
            while (doc.node.nodeName !== element.goBack) {
              doc = doc.up();
            }
          }
        } else {
          element.path.forEach(() => (doc = doc.up()));
        }
      });
    }
  }
} catch (err){
  console.log('------------', err)
}
  return doc;
}

const loanOwnedPropertyData = (data) => {
  if (data && Array.isArray(data) && data.length > 0) {
    return data.filter(
      (x) =>
        x.scheduleStatus &&
        x.scheduleStatus !== "" &&
        x.scheduleStatus !== "Sold"
    );
  }
};

const citizenshipDiagram = [
  { mismo: "USCitizen" },
  { lw: "Perm Resident Alien", mismo: "PermanentResidentAlien" },
  { lw: "Non-Perm Resident Alien", mismo: "NonPermanentResidentAlien" },
];

const ownershipInterestDiagram = [
  { lw: "eqmorethan25", mismo: "GreaterThanOrEqualTo25Percent" },
  { lw: "lessthan25", mismo: "LessThan25Percent" },
];

const assetTypeDiagram = [
  { lw: "cd", mismo: "CertificateOfDepositTimeDeposit" },
  { lw: "cash value of insurance", mismo: "LifeInsurance" },
  { lw: "Checking", mismo: "CheckingAccount" },
  { lw: "Savings", mismo: "SavingsAccount" },
  { lw: "Money Market", mismo: "MoneyMarketFund" },
  { lw: "stocks", mismo: "Stock" },
  { lw: "bonds", mismo: "Bond" },
  { lw: "trust account", mismo: "TrustAccount" },
  { lw: "bridge loan proceeds", mismo: "BridgeLoanNotDeposited" },
  { lw: "retirement", mismo: "RetirementFund" },
  { lw: "Non-Marketable Securities", mismo: "Other" },
  { mismo: "Other" },
];

const creditTypeDiagram = [
  { lw: "0", mismo: "Revolving" },
  { lw: "1", mismo: "Revolving" },
  { lw: "2", mismo: "Other" },
  { lw: "3", mismo: "Revolving" },
  { lw: "4", mismo: "Revolving" },
  { lw: "5", mismo: "Other" },
  { lw: "6", mismo: "Other" },
  { lw: "7", mismo: "Lease" },
  { lw: "8", mismo: "Installment" },
  { lw: "9", mismo: "Installment" },
  { lw: "10", mismo: "Other" },
  { lw: "11", mismo: "Other" },
  { lw: "12", mismo: "Other" },
  { lw: "13", mismo: "Installment" },
  { lw: "14", mismo: "Other" },
  { lw: "15", mismo: "Other" },
];

const contingentLiabilityDiagram = [
  { lw: "ProvisionforFederalIncomeTax", mismo: "Other" },
  { lw: "endorserOrCoMaker", mismo: "Other" },
  { lw: "legalClaimsJudgement", mismo: "Other" },
  { lw: "Other", mismo: "Other" },
];
const liabilityOtherDescriptionDiagram = [
  { lw: "0", mismo: "Alimony" },
  { lw: "1", mismo: "Auto Loan" },
  { lw: "2", mismo: "Business Debts" },
  { lw: "3", mismo: "Child Care" },
  { lw: "4", mismo: "Credit card" },
  { lw: "5", mismo: "IRS Tax" },
  { lw: "6", mismo: "Judgments" },
  { lw: "7", mismo: "Lease" },
  { lw: "8", mismo: "Loan on Life Insurance" },
  { lw: "9", mismo: "Medical" },
  { lw: "10", mismo: "Other" },
  { lw: "11", mismo: "Secured loans" },
  { lw: "12", mismo: "Separation Maintenance" },
  { lw: "13", mismo: "Student Loan" },
  { lw: "14", mismo: "Unpaid Property Taxes" },
  { lw: "15", mismo: "Unsecured loan" },
];
const scheduleStatusDiagram = [
  { lw: "Pending Sale", mismo: "PendingSale" },
  { mismo: "Retain" },
];

const intendedOccupancyDiagram = [
  { lw: "Investment", mismo: "Investment" },
  { lw: "Primary", mismo: "PrimaryResidence" },
  { lw: "Second Home", mismo: "SecondHome" },
  { mismo: "Other" },
];

const constructionMethodDiagram = [
  { lw: "Manufactured", mismo: "Manufactured" },
  { lw: "Mobile Home Park", mismo: "MobileHome" },
  { mismo: "Other" },
];

const loanTypeDiagram = [
  { lw: "Purchase", mismo: "Purchase" },
  { mismo: "Refinance" },
];
const maritalStatusDiagram = [
  { lw: "Married", mismo: "Married" },
  { lw: "Separated", mismo: "Separated" },
  { lw: "Single", mismo: "Unmarried" },
  { mismo: "Other" },
];
const employmentClassificationType = [
  { lw: "Salary W-2", mismo: "Primary" },
  { mismo: "Secondary" },
];
const genderDiagram = [{ lw: "2", mismo: "Female" }, { mismo: "Male" }];
function mapValue(value, diagram) {
  if (diagram && value) {
    const mismo = diagram.find(
      (x) => x.lw && x.lw.toLowerCase() === value.toLowerCase()
    );
    if (mismo) {
      return mismo.mismo;
    }
  }

  const defaultElement = diagram.find((x) => !x.lw);
  if (defaultElement) {
    return defaultElement.mismo;
  }
  return value;
}

function totalMonthlyIncome(yearlyIncomeArray, monthlyIncomeArray) {
  let total = 0;
  yearlyIncomeArray.forEach((i) => {
    if (i) {
      total += Math.floor(parseInt(i.replace(/,/g, "")) / 12);
    }
  });

  monthlyIncomeArray.forEach((i) => {
    if (i) {
      total += parseInt(i.replace(/,/g, ""));
    }
  });

  return total;
}

function money(amount) {
  if (amount) {
    const sanitizedAmount = amount.toString().replace(/,/g, "");
    if (sanitizedAmount) {
      return parseInt(sanitizedAmount).toFixed(2);
    }
  }
  return "0.00";
}
function tel(telNumber) {
  if (telNumber) {
    return telNumber.replace(/[^0-9]/g, "");
  }
}
function streetName(addressLine) {
  if (addressLine) {
    try {
      return addressLine.split(" ").slice(1).join(" ");
    } catch {}
  }
}
function streetNumber(addressLine) {
  if (addressLine) {
    try {
      return addressLine.split(" ")[0];
    } catch {}
  }
}

function sortNodes(nodes) {
  const sortedNodes = nodes.sort((a, b) => {
    const aKey = Object.keys(a)[0];
    const bKey = Object.keys(b)[0];
    if (aKey.toLowerCase() < bKey.toLowerCase()) {
      return -1;
    } else {
      return 1;
    }
  });

  return sortedNodes;
}

function indicator(value) {
  if (value == "Yes") {
    return "true";
  }
  return "false";
}

function relationships(
  _doc,
  borrowerAssets,
  borrowerLiabilities,
  hasCoborrower
) {
  _doc = _doc.ele("RELATIONSHIPS", { "xsi:type": "RELATIONSHIPS" });
  if (borrowerAssets && borrowerAssets.length > 0) {
    for (let i = 0; i < borrowerAssets.length; i++) {
      _doc = _doc
        .ele("RELATIONSHIP", {
          SequenceNumber: i + 1,
          "xlink:from": "ASSET_" + (i + 1).toString(),
          "xlink:to": "BORROWER_1",
          "xlink:arcrole":
            "urn:fdc:mismo.org:2009:residential/ASSET_IsAssociatedWith_ROLE",
        })
        .up();
    }
  }

  if (borrowerLiabilities && borrowerLiabilities.length > 0) {
    for (let i = 0; i < borrowerLiabilities.length; i++) {
      _doc = _doc
        .ele("RELATIONSHIP", {
          SequenceNumber: borrowerAssets.length + i + 1,
          "xlink:from": "LIABILITY_" + (i + 1).toString(),
          "xlink:to": "BORROWER_1",
          "xlink:arcrole":
            "urn:fdc:mismo.org:2009:residential/LIABILITY_IsAssociatedWith_ROLE",
        })
        .up();
    }
  }

  _doc = _doc
    .ele("RELATIONSHIP", {
      SequenceNumber: borrowerAssets.length + borrowerLiabilities.length + 1,
      "xlink:from": "CURRENT_INCOME_ITEM_1",
      "xlink:to": "EMPLOYER_1",
      "xlink:arcrole":
        "urn:fdc:mismo.org:2009:residential/CURRENT_INCOME_ITEM_IsAssociatedWith_EMPLOYER",
    })
    .up();

  if (hasCoborrower) {
    _doc = _doc
      .ele("RELATIONSHIP", {
        SequenceNumber: borrowerAssets.length + borrowerLiabilities.length + 2,
        "xlink:from": "CURRENT_INCOME_ITEM_2",
        "xlink:to": "EMPLOYER_2",
        "xlink:arcrole":
          "urn:fdc:mismo.org:2009:residential/CURRENT_INCOME_ITEM_IsAssociatedWith_EMPLOYER",
      })
      .up();

    _doc = _doc
      .ele("RELATIONSHIP", {
        SequenceNumber: borrowerAssets.length + borrowerLiabilities.length + 3,
        "xlink:from": "BORROWER_2",
        "xlink:to": "BORROWER_1",
        "xlink:arcrole":
          "urn:fdc:mismo.org:2009:residential/ROLE_SharesJointCreditReportWith_ROLE",
      })
      .up();
  }
  return _doc;
}

function removeEmptyNodes(doc) {
  let anEmptyNode = getEmptyNode(doc);

  while (anEmptyNode) {
    anEmptyNode.remove();
    anEmptyNode = getEmptyNode(doc);
  }
  return doc;
}
function getEmptyNode(doc) {
  return doc
    .root()
    .find(
      (n) =>
        n.node.textContent === "" &&
        n.node.nodeName != "RELATIONSHIPS" &&
        n.node.nodeName != "RELATIONSHIP",
      true,
      true
    );
}
function container(doc, path) {
  path.forEach((element) => {
    if (typeof element === "string" || element instanceof String) {
      doc = doc.ele(element);
    } else {
      doc = doc.ele(element.name, element.attributes);
    }
  });
  return doc;
}

function getMonthDuration(duration) {
  const match = duration.match(/\d+/gi);
  if (match && match.length) {
    if (duration.toLowerCase().includes("year")) {
      return match[0] * 12;
    }
    return match[0];
  }
  return "0";
}

function validDate(inDate){

  if (inDate && inDate.includes("0000")){
    return ""
  }
  return inDate;

}
module.exports = {
  createMismo,
};
