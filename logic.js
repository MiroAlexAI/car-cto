/**
 * Core TCO Calculation Logic
 * Separated from DOM for testing and reusability.
 */

const TCOLogic = {
    /**
     * Calculates the Year-by-Year TCO for Old vs New car.
     * @param {Object} data - Input data object
     * @returns {Object} - Result containing arrays for chart and final totals.
     */
    calculate: function (data) {
        const {
            years,
            mileage,
            fuelPrice,
            breakdownProb, // %
            repairPrice,
            currentMileage,
            overhaulInterval,
            // Finance
            inflation, // %
            discountRate, // %
            // Old Car
            oldCons,
            oldMaint,
            oldTax,
            oldPrice,
            oldDepr, // %
            savings, // Extra capital
            // New Car
            newPrice,
            newCons,
            newMaint,
            newTax,
            newDepr // %
        } = data;

        const inflRate = (inflation || 0) / 100;
        const discRate = (discountRate || 0) / 100;

        // Base Annual Costs (Year 1 Start Nominal)
        const oldFuelBase = (mileage / 100) * oldCons * fuelPrice;
        const newFuelBase = (mileage / 100) * newCons * fuelPrice;
        const riskBase = (breakdownProb / 100) * repairPrice;

        // OpEx Base (Nominal Year 0 terms)
        const oldOpBase = oldFuelBase + oldMaint + oldTax + riskBase;
        const newOpBase = newFuelBase + newMaint + newTax;

        const oldDeprRate = oldDepr / 100;
        const newDeprRate = newDepr / 100;

        // Arrays
        const labels = [];
        const oldData = []; // Cumulative PV
        const newData = []; // Cumulative PV
        const oldDeprData = []; // Asset Value (Nominal - for visual reference?) Usually Chart uses same scale. 
        // Mixing Nominal Asset Value with NPV Costs is tricky visually.
        // But "Residual Value" is usually Nominal.
        const newDeprData = []; // Nominal Asset Value
        const oldAnnualData = []; // Nominal Annual Spend
        const newAnnualData = []; // Nominal Annual Spend

        let cumOldPV = 0;
        let cumNewPV = 0;

        // Asset Values
        let currentOldVal = oldPrice;
        let currentNewVal = newPrice;

        let oldOdometer = currentMileage;
        let overhaulCount = 0;

        // Loop including Year 0
        for (let i = 0; i <= years; i++) {
            labels.push(`Год ${i}`);

            if (i === 0) {
                // Year 0: Initial Start.
                // Switch Cost = NewPrice - (OldPrice + Savings)
                // This happens NOW (t=0), so PV = Nominal.
                // For Old Car, cost is 0 (we already own it).

                const switchCost = newPrice - (oldPrice + (savings || 0));

                // Add to Cumulative PV
                cumOldPV += 0;
                cumNewPV += switchCost;

                oldData.push(cumOldPV);
                newData.push(cumNewPV);

                oldDeprData.push(currentOldVal);
                newDeprData.push(currentNewVal);

                oldAnnualData.push(0);
                newAnnualData.push(switchCost);
            } else {
                // Year > 0
                // 1. Inflation Factor for OpEx
                // We assume prices rise at straight inflation rate from base year
                const inflFactor = Math.pow(1 + inflRate, i - 1);
                // Using (i-1) if prices are set for Year 1 at start? 
                // Standard: Year 1 costs are usually paid at end of year 1? 
                // Or "Inflation per year". Let's assume OpEx inputs are "Today's prices".
                // So Year 1 nominal = Base * (1+inf). Year 2 = Base * (1+inf)^2.
                // The prompt says: OpEx_i = OpEx_base * (1 + inflation)^ (i-1).
                // implying Year 1 uses Base prices? Or Year 1 is first inflated year?
                // Formula: (i-1). So Year 1 = Base * 1. Year 2 = Base * (1+inf).
                // Meaning inputs are "Average Year 1 prices". Okay.
                const opExInflator = Math.pow(1 + inflRate, i - 1);

                // 2. Overhaul Logic (Old Car)
                const prevOdo = oldOdometer;
                oldOdometer += mileage;
                const repairsTriggered = Math.floor(oldOdometer / overhaulInterval) - Math.floor(prevOdo / overhaulInterval);

                let nominalOverhaulCost = 0;
                if (repairsTriggered > 0) {
                    // Repair price also inflates
                    nominalOverhaulCost = repairsTriggered * repairPrice * opExInflator;
                    overhaulCount += repairsTriggered;
                }

                // 3. OpEx Nominal
                const nominalOldOpEx = (oldOpBase * opExInflator) + nominalOverhaulCost;
                const nominalNewOpEx = (newOpBase * opExInflator);

                // 4. Depreciation (Asset Loss)
                const oldDeprLoss = currentOldVal * oldDeprRate;
                currentOldVal -= oldDeprLoss;

                const newDeprLoss = currentNewVal * newDeprRate;
                currentNewVal -= newDeprLoss;

                // 5. Total Annual Loss (Nominal)
                const annualOldLossNominal = nominalOldOpEx + oldDeprLoss;
                const annualNewLossNominal = nominalNewOpEx + newDeprLoss;

                // 6. Discounting to PV
                // PV = Nominal / (1 + r)^i
                const discountFactor = Math.pow(1 + discRate, i);

                const pvOldLoss = annualOldLossNominal / discountFactor;
                const pvNewLoss = annualNewLossNominal / discountFactor;

                // 7. Update Cumulative
                cumOldPV += pvOldLoss;
                cumNewPV += pvNewLoss;

                oldData.push(cumOldPV);
                newData.push(cumNewPV);

                oldDeprData.push(currentOldVal);
                newDeprData.push(currentNewVal);

                // For bars, we show Nominal Spend (Cash Out + Asset Loss)
                // Or just Cash Out? "Затраты за год". Usually implies Cashflow. 
                // But previously we included Depr Loss in bars too. I'll stick to Total Loss Nominal.
                oldAnnualData.push(annualOldLossNominal);
                newAnnualData.push(annualNewLossNominal);
            }
        }

        return {
            labels,
            oldData,
            newData,
            oldDeprData,
            newDeprData,
            oldAnnualData,
            newAnnualData,
            finalOld: cumOldPV,
            finalNew: cumNewPV,
            overhaulCount,
            diff: cumNewPV - cumOldPV
        };
    },

    /**
     * Calculates optimization recommendations
     * Used for "Auto-pick" feature
     */
    optimize: function (data) {
        const {
            years,
            mileage,
            fuelPrice,
            breakdownProb,
            repairPrice,
            overhaulInterval,
            inflation,
            discountRate,
            oldCons,
            oldMaint,
            oldTax,
            oldPrice,
            oldDepr,
            newDepr, // % Global setting for New Car Depreciation
            newPrice,
            savings
        } = data;

        const inflRate = (inflation || 0) / 100;
        const discRate = (discountRate || 0) / 100;

        // --- 1. Calculate Accurate Old TCO (NPV Simulation) ---
        let simOldVal = oldPrice;
        let simOldOdo = 0;
        let simOldPV = 0;
        const oldDeprRate = oldDepr / 100;

        // Base OpEx
        const riskYear = (breakdownProb / 100) * repairPrice;
        const oldBaseOpEx = oldMaint + oldTax + riskYear + ((mileage / 100) * oldCons * fuelPrice);

        for (let i = 1; i <= years; i++) {
            const inflFactor = Math.pow(1 + inflRate, i - 1);
            const discFactor = Math.pow(1 + discRate, i);

            // Overhauls
            const prevOdo = simOldOdo;
            simOldOdo += mileage;
            const repairs = Math.floor(simOldOdo / overhaulInterval) - Math.floor(prevOdo / overhaulInterval);
            let overhaulCost = 0;
            if (repairs > 0) overhaulCost = repairs * repairPrice * inflFactor;

            // OpEx Nominal
            const nominalOpEx = (oldBaseOpEx * inflFactor) + overhaulCost;

            // Depreciation
            const deprLoss = simOldVal * oldDeprRate;
            simOldVal -= deprLoss;

            // Annual Total Loss Nominal
            const annualLoss = nominalOpEx + deprLoss;

            // Add PV
            simOldPV += annualLoss / discFactor;
        }

        // Note: In logic.js calculate(), we check (Price - EndVal) via DeprLoss sum or direct subtract?
        // In the loop above, we summed "DeprLoss / DiscountFactor".
        // This is mathematically "Sum of PV of annual value drops".
        // This is correct for the logic "Loss of Wealth".
        // The previous simple logic "Spend + (Start - End)" assumes no time value.
        // With time value, we MUST sum discounted annual drops.
        const targetNPV = simOldPV;


        // --- 2. Solve for Max Price (Target: NewNPV <= OldNPV) ---
        // NewNPV = SwitchCost + PV_OpEx_New + PV_Depr_New
        // SwitchCost = P - OldPrice - Savings
        // PV_OpEx_New = Sum(OpEx_Base_New * Infl * Disc)
        // PV_Depr_New = Sum(P * DeprCoeff * Disc) = P * Sum(...)

        // Target Specs (Ideals)
        const targetCons = oldCons * 0.9;
        const targetMaint = oldMaint * 0.85;
        const targetTax = oldTax;

        const newBaseOpEx = ((mileage / 100) * targetCons * fuelPrice) + targetMaint + targetTax;

        let sumPVOpEx = 0;
        let sumPVDeprFactor = 0; // Sum of (DeprLoss_fraction / Disc)

        const newDeprRate = newDepr / 100;
        let currentAssetFraction = 1.0; // Starts at 1.0 * P

        for (let i = 1; i <= years; i++) {
            const inflFactor = Math.pow(1 + inflRate, i - 1);
            const discFactor = Math.pow(1 + discRate, i);

            // OpEx PV
            const nominalOpEx = newBaseOpEx * inflFactor;
            sumPVOpEx += nominalOpEx / discFactor;

            // Depreciation PV Factor
            // Loss = Val_{i-1} * rate
            // Val_{i-1} = P * currentAssetFraction
            const lossFraction = currentAssetFraction * newDeprRate;
            sumPVDeprFactor += lossFraction / discFactor;

            // Update Asset Fraction
            currentAssetFraction -= lossFraction;
        }

        // Equation:
        // TargetNPV >= (P - (OldPrice + Savings)) + sumPVOpEx + P * sumPVDeprFactor
        // TargetNPV + OldPrice + Savings - sumPVOpEx >= P * (1 + sumPVDeprFactor)
        // P <= (TargetNPV + OldPrice + Savings - sumPVOpEx) / (1 + sumPVDeprFactor)

        const offset = (oldPrice + (savings || 0));
        const numerator = targetNPV + offset - sumPVOpEx;
        const denominator = 1 + sumPVDeprFactor;

        let recPrice = 0;
        if (numerator > 0) {
            recPrice = numerator / denominator;
        }

        return {
            recPrice,
            recCons: targetCons,
            params: {
                years,
                mileage,
                oldTCO: targetNPV,
                oldOpYear: oldBaseOpEx,
                newOpYear: newBaseOpEx,
                deprFactor: sumPVDeprFactor, // rough indicator
                targetMaint
            }
        };
    }
};

// Export for Node/Tests if needed, otherwise it's a global in browser
if (typeof module !== 'undefined' && module.exports) {
    module.exports = TCOLogic;
}
