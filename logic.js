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
            capitalRate, // % Annual Interest
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
        const capRate = (capitalRate || 0) / 100; // Capital Rate factor

        // Arrays for Chart
        const labels = [];
        const oldData = [];
        const newData = [];
        const oldDeprData = [];
        const newDeprData = [];

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
                const switchCost = newPrice - (oldPrice + savings);

                oldData.push(0);
                newData.push(switchCost);

                // Asset Values
                oldDeprData.push(oldPrice);
                newDeprData.push(newPrice);
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

                // 2. Capital Opportunity Cost (Lost Interest)
                // Calculated on the value TIED UP in the car at the start of the year.
                // For Old Car: currentOldVal
                // For New Car: currentNewVal
                const oldCapCost = currentOldVal * capRate;
                const newCapCost = currentNewVal * capRate;

                // 3. Depreciation
                const oldDeprLoss = currentOldVal * oldDeprRate;
                currentOldVal -= oldDeprLoss;

                const newDeprLoss = currentNewVal * newDeprRate;
                currentNewVal -= newDeprLoss;

                // 4. Cumulative Spending Update
                cumOldSpend += oldOpBase + thisYearOverhaulCost + oldCapCost;
                cumNewSpend += newOpBase + newCapCost;

                // 5. Total Loss Calculation
                // Loss = Cumulative Cash Out (Expenses + Capital) + Loss of Asset Value (Depreciation)
                // Note: oldPrice - currentOldVal = Total Depreciation so far.

                const totalOldLoss = cumOldSpend + (oldPrice - currentOldVal);

                // For New: We include the initial Switch Cost in the "Spending".
                // SwitchCost = NewPrice - (OldPrice + Savings).
                // Total New Loss = SwitchCost + Ops/Cap Spending + Depreciation.
                const switchCost = newPrice - (oldPrice + savings);
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
            finalOld: oldData[years],
            finalNew: newData[years],
            overhaulCount,
            diff: newData[years] - oldData[years]
        };
    },
    /**
     * Calculates optimization recommendations
     * @param {Object} data - Input data object
     * @returns {Object} - Recommendation result
     */
    optimize: function (data) {
        const {
            years,
            mileage,
            fuelPrice,
            breakdownProb,
            repairPrice,
            overhaulInterval,
            capitalRate,
            oldCons,
            oldMaint,
            oldTax,
            oldPrice,
            oldDepr,
            newCons,
            newMaint,
            newTax,
            newDepr, // %
            newPrice
        } = data;

        const capRate = (capitalRate || 0) / 100;

        // --- 1. Calculate Accurate Old TCO (Simulation) ---
        // We must replicate the loop to catch Overhauls and declining Asset Value for Capital Cost
        let simOldVal = oldPrice;
        let simOldOdo = 0; // Relative start
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

            // Capital Cost (on Start of Year Value)
            const capCost = simOldVal * capRate;

            // Depreciation
            const deprLoss = simOldVal * oldDeprRate;
            simOldVal -= deprLoss;

            // Total Spend
            simOldSpend += oldAnnualFixed + oldFuelYear + overhaulCost + capCost;
        }

        // Total Old Loss = Spend + TotalDepreciation
        const oldTotalDepr = oldPrice - simOldVal;
        const oldTCO = simOldSpend + oldTotalDepr;


        // --- 2. Solve for Max Price (Target: NewTCO <= OldTCO) ---
        // NewTCO = Ops + CapitalCost + Depreciation
        // Ops is fixed (excluding Price)
        const newOpYear = ((mileage / 100) * newCons * fuelPrice) + newMaint + newTax;
        const newOpsTotal = newOpYear * years;

        // Remaining Budget for (Capital + Depreciation)
        const budgetForAsset = oldTCO - newOpsTotal;

        // We need to express Capital + Depreciation as function of Price (P)
        // DeprTotal = P * (1 - (1-r)^n)
        // CapitalTotal approx = Sum of (Value_i * CapRate). 
        // Value_i decays.
        // Exact sum of Value_i over n years (geometric series):
        // P * Sum((1-r)^k) for k=0 to n-1
        // Let D = (1 - newDepr/100)
        // SumVal = P * (1 - D^n) / (1 - D)
        // TotalCapCost = SumVal * CapRate

        // So: Cost_Asset = (P * DeprFactor) + (P * CapFactor * CapRate)
        // Cost_Asset = P * (DeprFactor + CapFactor*CapRate)

        const newDeprRate = newDepr / 100;
        const decay = 1 - newDeprRate;
        const deprFactor = 1 - Math.pow(decay, years); // % of Price lost

        // Geometric sum for Capital Cost base
        let geomSum = 0;
        if (newDeprRate === 0) {
            geomSum = years;
        } else {
            geomSum = (1 - Math.pow(decay, years)) / (1 - decay);
        }
        const capitalFactor = geomSum * capRate;

        // Solve: P * (deprFactor + capitalFactor) = budgetForAsset
        // P = budgetForAsset / (deprFactor + capitalFactor)

        let recPrice = 0;
        if (budgetForAsset > 0) {
            recPrice = budgetForAsset / (deprFactor + capitalFactor);
        }

        // --- 3. Solve for Target Consumption (recCons) ---
        // Fixed Price (User Input)
        // NewTCO = (Fuel + FixedMaint) * Years + FixedDepr + FixedCapCost

        // Calculate costs for the specific New Price entered by user
        const fixedNewDeprTotal = newPrice * deprFactor;
        const fixedNewCapTotal = newPrice * capitalFactor;
        const fixedMaintTotal = (newMaint + newTax) * years;

        const maxFuelTotal = oldTCO - fixedMaintTotal - fixedNewDeprTotal - fixedNewCapTotal;

        let recCons = 0;
        if (maxFuelTotal > 0) {
            const maxFuelYear = maxFuelTotal / years;
            // FuelCost = (Mileage/100) * Cons * FuelPrice
            // Cons = (FuelCost * 100) / (Mileage * FuelPrice)
            recCons = (maxFuelYear * 100) / (mileage * fuelPrice);
        }

        return {
            recPrice,
            recCons,
            params: {
                years,
                mileage,
                oldTCO,
                oldOpYear: oldAnnualFixed + oldFuelYear, // Average ref
                newOpYear,
                deprFactor
            }
        };
    }
};

// Export for Node/Tests if needed, otherwise it's a global in browser
if (typeof module !== 'undefined' && module.exports) {
    module.exports = TCOLogic;
}
