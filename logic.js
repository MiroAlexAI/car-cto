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
            breakdownProb, // % (0-100)
            repairPrice,
            currentMileage,
            overhaulInterval,
            // Old Car
            oldCons,
            oldMaint,
            oldTax,
            oldPrice,
            oldDepr, // % (0-100)
            savings, // Extra capital
            // New Car
            newPrice,
            newCons,
            newMaint,
            newTax,
            newDepr // % (0-100)
        } = data;

        // Base Annual Costs
        const oldFuelYear = (mileage / 100) * oldCons * fuelPrice;
        const newFuelYear = (mileage / 100) * newCons * fuelPrice;

        const annualRandomRisk = (breakdownProb / 100) * repairPrice;

        const oldOpBase = oldFuelYear + oldMaint + oldTax + annualRandomRisk;
        const newOpBase = newFuelYear + newMaint + newTax;

        const oldDeprRate = oldDepr / 100;
        const newDeprRate = newDepr / 100;

        // Arrays for Chart
        const labels = [];
        const oldData = []; // Cumulative
        const newData = []; // Cumulative
        const oldDeprData = []; // Asset Value
        const newDeprData = []; // Asset Value
        const oldAnnualData = []; // Annual Bar
        const newAnnualData = []; // Annual Bar

        let cumOldSpend = 0;
        let cumNewSpend = 0;
        let currentOldVal = oldPrice;
        let currentNewVal = newPrice;
        let oldOdometer = currentMileage;
        let overhaulCount = 0;

        for (let i = 0; i <= years; i++) {
            labels.push(`Год ${i}`);

            if (i === 0) {
                // Year 0: Initial Start.
                // Switching Cost is the immediate cash flow impact: New Price - (Old Price + Savings).
                const switchCost = newPrice - (oldPrice + (savings || 0));

                oldData.push(0);
                newData.push(switchCost);

                // Asset Values
                oldDeprData.push(oldPrice);
                newDeprData.push(newPrice);

                // Annual Data (Year 0 impact)
                oldAnnualData.push(0);
                newAnnualData.push(switchCost);
            } else {
                // 1. Overhaul Logic (Old Car)
                const prevOdo = oldOdometer;
                oldOdometer += mileage;
                const repairsTriggered = Math.floor(oldOdometer / overhaulInterval) - Math.floor(prevOdo / overhaulInterval);

                let thisYearOverhaulCost = 0;
                if (repairsTriggered > 0) {
                    thisYearOverhaulCost = repairsTriggered * repairPrice;
                    overhaulCount += repairsTriggered;
                }

                // 2. Depreciation
                const oldDeprLoss = currentOldVal * oldDeprRate;
                currentOldVal -= oldDeprLoss;

                const newDeprLoss = currentNewVal * newDeprRate;
                currentNewVal -= newDeprLoss;

                // 3. Cumulative Spending Update
                cumOldSpend += oldOpBase + thisYearOverhaulCost;
                cumNewSpend += newOpBase;

                // 4. Annual Loss Calculation (for Bars)
                const annualOldLoss = oldOpBase + thisYearOverhaulCost + oldDeprLoss;
                const annualNewLoss = newOpBase + newDeprLoss;

                oldAnnualData.push(annualOldLoss);
                newAnnualData.push(annualNewLoss);

                // 5. Total Loss Calculation (Cumulative)
                // Loss = Cumulative Cash Out (Expenses) + Loss of Asset Value (Depreciation)
                // Note: oldPrice - currentOldVal = Total Depreciation so far.

                const totalOldLoss = cumOldSpend + (oldPrice - currentOldVal);

                // For New: We include the initial Switch Cost in the "Spending".
                // SwitchCost = NewPrice - (OldPrice + Savings).
                // Total New Loss = SwitchCost + Ops Spending + Depreciation.
                const switchCost = newPrice - (oldPrice + (savings || 0));
                const totalNewLoss = switchCost + cumNewSpend + (newPrice - currentNewVal);

                oldData.push(totalOldLoss);
                newData.push(totalNewLoss);

                oldDeprData.push(currentOldVal);
                newDeprData.push(currentNewVal);
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
            finalOld: oldData[years],
            finalNew: newData[years],
            overhaulCount,
            diff: newData[years] - oldData[years]
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
            oldCons,
            oldMaint,
            oldTax,
            oldPrice,
            oldDepr,
            newDepr, // % Global setting for New Car Depreciation
            newPrice // We use this only for the Consumption calc part (which is secondary now)
        } = data;

        // --- 1. Calculate Accurate Old TCO (Simulation) ---
        let simOldVal = oldPrice;
        let simOldOdo = 0;
        let simOldSpend = 0;
        const oldDeprRate = oldDepr / 100;

        const oldAnnualFixed = oldMaint + oldTax + ((breakdownProb / 100) * repairPrice);
        const oldFuelYear = (mileage / 100) * oldCons * fuelPrice;

        for (let i = 1; i <= years; i++) {
            // Overhauls
            const prevOdo = simOldOdo;
            simOldOdo += mileage;
            const repairs = Math.floor(simOldOdo / overhaulInterval) - Math.floor(prevOdo / overhaulInterval);
            let overhaulCost = 0;
            if (repairs > 0) overhaulCost = repairs * repairPrice;

            // Depreciation
            const deprLoss = simOldVal * oldDeprRate;
            simOldVal -= deprLoss;

            // Total Spend (No Capital Cost)
            simOldSpend += oldAnnualFixed + oldFuelYear + overhaulCost;
        }

        const oldTotalDepr = oldPrice - simOldVal;
        const oldTCO = simOldSpend + oldTotalDepr;


        // --- 2. Solve for Max Price based on TARGET SPECS ---
        // Constraint: New TCO <= Old TCO
        // Target Specifications:
        // Cons = OldCons * 0.9 (-10%)
        // Maint = OldMaint * 0.85 (-15%)
        // Tax = OldTax (Assumed same)
        // Risks = 0 (Assumed new car reliability)

        const targetCons = oldCons * 0.9;
        const targetMaint = oldMaint * 0.85;
        const targetTax = oldTax;

        // New Ops Annual
        const targetFuelYear = (mileage / 100) * targetCons * fuelPrice;
        const targetAnnualOps = targetFuelYear + targetMaint + targetTax;

        const newOpsTotal = targetAnnualOps * years;

        // Remaining Budget for Depreciation
        // OldTCO = NewOpsTotal + NewTotalDepreciation
        // NewTotalDepr = OldTCO - NewOpsTotal
        const allowedDeprTotal = oldTCO - newOpsTotal;

        // NewTotalDepr = Price * DeprFactor
        // DeprFactor = 1 - (1-rate)^n
        const newDeprRate = newDepr / 100;
        const decay = 1 - newDeprRate;
        const deprFactor = 1 - Math.pow(decay, years);

        let recPrice = 0;
        if (allowedDeprTotal > 0 && deprFactor > 0) {
            recPrice = allowedDeprTotal / deprFactor;
        }

        // --- 3. Recommendation Text Data ---
        // We pass back the simulated improvements

        return {
            recPrice,
            // We return 0 for recCons because we enforced a strict target (Old - 10%)
            // but we can return the TARGET Cons to display it.
            recCons: targetCons,
            params: {
                years,
                mileage,
                oldTCO,
                oldOpYear: oldAnnualFixed + oldFuelYear,
                newOpYear: targetAnnualOps,
                deprFactor,
                targetMaint
            }
        };
    }
};

// Export for Node/Tests if needed, otherwise it's a global in browser
if (typeof module !== 'undefined' && module.exports) {
    module.exports = TCOLogic;
}
