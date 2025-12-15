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
            riskGrowth, // boolean
            riskMileage, // boolean
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

        // Note: Risk is now dynamic inside the loop

        // OpEx Base without Risk (Nominal Year 0 terms)
        const oldOpBaseNoRisk = oldFuelBase + oldMaint + oldTax;
        const newOpBase = newFuelBase + newMaint + newTax;

        const oldDeprRate = oldDepr / 100;
        const newDeprRate = newDepr / 100;

        // Arrays
        const labels = [];
        const oldData = []; // Cumulative PV
        const newData = []; // Cumulative PV

        // Asset Values (Nominal)
        const oldDeprData = [];
        const newDeprData = [];

        const oldAnnualData = []; // Nominal Annual Spend (OpEx + Overhaul)
        const newAnnualData = []; // Nominal Annual Spend (OpEx + Overhaul)

        let cumOldPV = 0;
        let cumNewPV = 0;

        // Asset Values
        let currentOldVal = oldPrice;
        let currentNewVal = newPrice;

        let oldOdometer = currentMileage;
        let overhaulCount = 0;

        for (let i = 0; i <= years; i++) {
            labels.push(`Год ${i}`);

            if (i === 0) {
                // Year 0
                // Switch Cost
                const switchCost = newPrice - (oldPrice + (savings || 0));

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
                const inflFactor = Math.pow(1 + inflRate, i - 1);
                const opExInflator = Math.pow(1 + inflRate, i - 1);
                const discFactor = Math.pow(1 + discRate, i);

                // 1. Dynamic Risk
                let currentRiskProb = breakdownProb;

                // Age Growth
                if (riskGrowth) {
                    currentRiskProb = currentRiskProb * Math.pow(1.5, i - 1);
                }

                // Mileage Growth
                if (riskMileage) {
                    const mileageFactor = 1 + 0.2 * (oldOdometer / 100000);
                    currentRiskProb = currentRiskProb * mileageFactor;
                }

                if (currentRiskProb > 100) currentRiskProb = 100;

                const annualRiskCost = (currentRiskProb / 100) * repairPrice * opExInflator;

                // 2. Overhaul (Old Car)
                const prevOdo = oldOdometer;
                oldOdometer += mileage;
                const repairsTriggered = Math.floor(oldOdometer / overhaulInterval) - Math.floor(prevOdo / overhaulInterval);

                let nominalOverhaulCost = 0;
                if (repairsTriggered > 0) {
                    nominalOverhaulCost = repairsTriggered * repairPrice * opExInflator;
                    overhaulCount += repairsTriggered;
                }

                // 3. OpEx Nominal (Fuel, Maint, Tax) + Risk + Overhaul
                const nominalOldOpEx = (oldOpBaseNoRisk * opExInflator) + annualRiskCost + nominalOverhaulCost;
                const nominalNewOpEx = (newOpBase * opExInflator);

                // 4. Asset Value Updates (for Final Calculation)
                currentOldVal = currentOldVal * (1 - oldDeprRate);
                currentNewVal = currentNewVal * (1 - newDeprRate);

                // 5. PV of OpEx
                const pvOldOpEx = nominalOldOpEx / discFactor;
                const pvNewOpEx = nominalNewOpEx / discFactor;

                // 6. Update Cumulative (OpEx Only)
                cumOldPV += pvOldOpEx;
                cumNewPV += pvNewOpEx;

                // 7. Calculate "TCO if sold this year" for the Chart
                // We add the PV of the depreciation realized if we sell at year i.
                // TermDepr = (StartPrice - CurrentVal) / (1+r)^i
                const oldResidueLoss = oldPrice - currentOldVal;
                const newResidueLoss = newPrice - currentNewVal;

                const currentTermDeprOld = oldResidueLoss / discFactor;
                const currentTermDeprNew = newResidueLoss / discFactor;

                // The Chart Point is Operational PV + Depreciation PV
                oldData.push(cumOldPV + currentTermDeprOld);
                newData.push(cumNewPV + currentTermDeprNew);

                oldDeprData.push(currentOldVal);
                newDeprData.push(currentNewVal);

                // Bars: Show Nominal OpEx
                oldAnnualData.push(nominalOldOpEx);
                newAnnualData.push(nominalNewOpEx);
            }
        }

        // Final values from the array (which include the Terminal Depr jump)
        const finalOld = oldData[years];
        const finalNew = newData[years];

        return {
            labels,
            oldData,
            newData,
            oldDeprData,
            newDeprData,
            oldAnnualData,
            newAnnualData,
            finalOld,
            finalNew,
            overhaulCount,
            diff: finalNew - finalOld
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
            riskGrowth,
            repairPrice,
            overhaulInterval,
            inflation,
            discountRate,
            oldCons,
            oldMaint,
            oldTax,
            oldPrice,
            oldDepr,
            newDepr, // %
            newPrice,
            savings
        } = data;

        const inflRate = (inflation || 0) / 100;
        const discRate = (discountRate || 0) / 100;

        // --- 1. Calculate TCO_old_NPV ---
        // Sum PV(OpEx) + PV(TermDepr)

        // Base OpEx without Risk (Nominal)
        const oldBaseOpExNoRisk = oldMaint + oldTax + ((mileage / 100) * oldCons * fuelPrice);

        let sumPVOpExOld = 0;

        // Simulation for Overhauls and OpEx
        let simOldOdo = 0;
        for (let i = 1; i <= years; i++) {
            const inflFactor = Math.pow(1 + inflRate, i - 1);
            const discFactor = Math.pow(1 + discRate, i);

            // Dynamic Risk Logic
            let currentRiskProb = breakdownProb;
            if (riskGrowth) {
                // Growth 50% per year: base * (1.5)^(i-1)
                currentRiskProb = breakdownProb * Math.pow(1.5, i - 1);
                if (currentRiskProb > 100) currentRiskProb = 100;
            }
            const annualRiskCost = (currentRiskProb / 100) * repairPrice * inflFactor;

            // Overhauls
            const prevOdo = simOldOdo;
            simOldOdo += mileage;
            const repairs = Math.floor(simOldOdo / overhaulInterval) - Math.floor(prevOdo / overhaulInterval);
            let overhaulCost = 0;
            if (repairs > 0) overhaulCost = repairs * repairPrice * inflFactor;

            const nominalOpEx = (oldBaseOpExNoRisk * inflFactor) + annualRiskCost + overhaulCost;
            sumPVOpExOld += nominalOpEx / discFactor;
        }

        // Terminal Depr Old
        // Value_end = Price * (1-d)^N
        // TermDepr = (Price - Value) / (1+r)^N
        const oldDeprRate = oldDepr / 100;
        const oldEndVal = oldPrice * Math.pow(1 - oldDeprRate, years);
        const termDeprPVOld = (oldPrice - oldEndVal) / Math.pow(1 + discRate, years);

        const tcoOldNPV = sumPVOpExOld + termDeprPVOld;


        // --- 2. Calculate New Target ---
        // Target OpEx
        const targetCons = oldCons * 0.9;
        const targetMaint = oldMaint * 0.85;
        const targetTax = oldTax;

        const newBaseOpEx = ((mileage / 100) * targetCons * fuelPrice) + targetMaint + targetTax;

        let sumPVOpExNew = 0;
        for (let i = 1; i <= years; i++) {
            const inflFactor = Math.pow(1 + inflRate, i - 1);
            const discFactor = Math.pow(1 + discRate, i);
            const nominalOpEx = newBaseOpEx * inflFactor;
            sumPVOpExNew += nominalOpEx / discFactor;
        }

        // --- 3. Solve for Price Max ---
        // Formula: P = (TCO_Old + Offset - PV_OpEx_New) / (1 + TermDeprFactor)
        // Offset = OldPrice + Savings
        // TermDeprFactor = (1 - (1-dNew)^N) / (1+r)^N

        const newDeprRate = newDepr / 100;
        const newDecay = Math.pow(1 - newDeprRate, years); // (1-d)^N
        const totalDropPct = 1 - newDecay; // (1 - (1-d)^N)
        const finalDisc = Math.pow(1 + discRate, years);

        const termDeprFactor = totalDropPct / finalDisc;

        const offset = oldPrice + (savings || 0);

        const numerator = tcoOldNPV + offset - sumPVOpExNew;
        const denominator = 1 + termDeprFactor;

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
                oldTCO: tcoOldNPV,
                oldOpYear: oldBaseOpExNoRisk,
                newOpYear: newBaseOpEx,
                deprFactor: termDeprFactor,
                targetMaint
            }
        };
    }
};

// Export for Node/Tests if needed, otherwise it's a global in browser
if (typeof module !== 'undefined' && module.exports) {
    module.exports = TCOLogic;
}
